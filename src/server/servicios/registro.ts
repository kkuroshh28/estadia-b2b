import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { cuentasBancarias, usuarios } from "../db/schema";
import { cifrar, hashCedula } from "../crypto";
import { asignarAliasUnico } from "./alias";
import { identidadBaneada } from "./antifuga";
import { obtenerKyc } from "../adaptadores/kyc";

export class RegistroError extends Error {}

export interface DatosRegistro {
  nombreReal: string;
  cedula: string;
  email: string;
  telefono: string;
  rol: "propietario" | "principal" | "externo";
  /** Cuenta de dispersión (se cifra en reposo; certifica el equipo después). */
  cuentaBancaria?: { banco: string; numero: string };
}

/**
 * Registro real: valida lista negra ANTES de crear, guarda cédula/teléfono
 * cifrados, deja al usuario en pendiente_kyc, asigna alias (comisionistas)
 * con el servicio de unicidad, e inicia la verificación con el proveedor KYC.
 */
export async function registrarUsuario(
  db: Db,
  datos: DatosRegistro,
): Promise<{ usuarioId: string; alias: string | null; kycCheckId: string }> {
  const cedulaHash = hashCedula(datos.cedula);

  // Ban perpetuo A LA IDENTIDAD: un baneado no vuelve ni con otro correo.
  if (await identidadBaneada(db, cedulaHash)) {
    throw new RegistroError("Identidad no admitida en la plataforma.");
  }

  const [existente] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.cedulaHash, cedulaHash));
  if (existente) throw new RegistroError("Ya existe una cuenta con esta cédula.");

  const [u] = await db
    .insert(usuarios)
    .values({
      nombreReal: datos.nombreReal.trim(),
      cedulaHash,
      cedulaCifrada: cifrar(datos.cedula.trim()),
      email: datos.email.trim().toLowerCase(),
      telefonoCifrado: cifrar(datos.telefono.trim()),
      roles: [datos.rol],
      estado: "pendiente_kyc",
    })
    .returning({ id: usuarios.id });

  if (datos.cuentaBancaria?.banco && datos.cuentaBancaria?.numero) {
    await db.insert(cuentasBancarias).values({
      usuarioId: u.id,
      banco: datos.cuentaBancaria.banco.trim().slice(0, 60),
      numeroCifrado: cifrar(datos.cuentaBancaria.numero.trim()),
    });
  }

  const alias =
    datos.rol === "propietario" ? null : await asignarAliasUnico(db, u.id);

  const { checkId } = await obtenerKyc().iniciarVerificacion(db, u.id);
  return { usuarioId: u.id, alias, kycCheckId: checkId };
}
