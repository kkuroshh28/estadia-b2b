import { eq, or } from "drizzle-orm";
import type { Db } from "../db";
import { cuentasBancarias, usuarios } from "../db/schema";
import { cifrar, hashCedula } from "../crypto";
import { asignarAliasUnico } from "./alias";
import { identidadBaneada } from "./antifuga";
import { obtenerKyc } from "../adaptadores/kyc";

export class RegistroError extends Error {}

/** Respuesta ÚNICA para cédula baneada, cédula o correo existente: no enumerar identidades. */
const NO_REGISTRABLE = "No pudimos completar el registro con estos datos.";

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
 * cifrados, deja al usuario en pendiente_kyc, asigna alias (socios)
 * con el servicio de unicidad, e inicia la verificación con el proveedor KYC.
 */
export async function registrarUsuario(
  db: Db,
  datos: DatosRegistro,
): Promise<{ usuarioId: string; alias: string | null; kycCheckId: string }> {
  const cedulaHash = hashCedula(datos.cedula);

  // Ban perpetuo A LA IDENTIDAD: un baneado no vuelve ni con otro correo.
  if (await identidadBaneada(db, cedulaHash)) {
    throw new RegistroError(NO_REGISTRABLE);
  }

  const email = datos.email.trim().toLowerCase();
  const [existente] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(or(eq(usuarios.cedulaHash, cedulaHash), eq(usuarios.email, email)));
  if (existente) throw new RegistroError(NO_REGISTRABLE);

  const [u] = await db
    .insert(usuarios)
    .values({
      nombreReal: datos.nombreReal.trim(),
      cedulaHash,
      cedulaCifrada: cifrar(datos.cedula.trim()),
      email,
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

  // Anexo II: identidad protegida para TODOS los roles — el dueño también
  // opera con alias en las negociaciones.
  const alias = await asignarAliasUnico(db, u.id);

  const { checkId } = await obtenerKyc().iniciarVerificacion(db, u.id);
  return { usuarioId: u.id, alias, kycCheckId: checkId };
}
