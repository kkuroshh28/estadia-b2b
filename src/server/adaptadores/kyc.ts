import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { usuarios } from "../db/schema";
import { identidadBaneada } from "../servicios/antifuga";

/**
 * Adaptador KYC. Driver por env KYC_DRIVER: "simulado" (default — aprobación/
 * rechazo controlable para pruebas) | "truora" (real, sandbox; requiere
 * TRUORA_API_KEY, se enciende sin tocar código).
 *
 * El estado del usuario se mueve SOLO por procesarResultado(): ni el cliente
 * ni el admin cambian pendiente_kyc → activo por otra vía.
 */
export interface ResultadoKyc {
  checkId: string;
  aprobado: boolean;
  biometriaProveedorId?: string;
}

export interface ProveedorKYC {
  iniciarVerificacion(db: Db, usuarioId: string): Promise<{ checkId: string }>;
  /** Aplica el resultado (webhook/callback del proveedor o simulación). */
  procesarResultado(db: Db, resultado: ResultadoKyc): Promise<"activo" | "kyc_rechazado">;
}

/** Núcleo compartido: TODO driver pasa por aquí (incluida la lista negra). */
async function aplicarResultado(db: Db, r: ResultadoKyc): Promise<"activo" | "kyc_rechazado"> {
  const [u] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.kycProveedorId, r.checkId));
  if (!u) throw new Error(`KYC: check desconocido ${r.checkId}`);

  // La identidad VERIFICADA se compara contra la lista negra: un baneado que
  // intente re-registrarse con otro correo se detecta y rechaza AQUÍ.
  const enListaNegra = await identidadBaneada(db, u.cedulaHash);
  const estado = r.aprobado && !enListaNegra ? "activo" : "kyc_rechazado";

  await db
    .update(usuarios)
    .set({
      estado,
      kycVerificadoEn: estado === "activo" ? new Date() : null,
    })
    .where(eq(usuarios.id, u.id));
  return estado;
}

const simulado: ProveedorKYC = {
  async iniciarVerificacion(db, usuarioId) {
    const checkId = `sim-${usuarioId}`;
    await db.update(usuarios).set({ kycProveedorId: checkId }).where(eq(usuarios.id, usuarioId));
    return { checkId };
  },
  procesarResultado: aplicarResultado,
};

const truora: ProveedorKYC = {
  async iniciarVerificacion(db, usuarioId) {
    // API sandbox de Truora: crear un check de identidad (cédula CO + face).
    const res = await fetch("https://api.identity.truora.com/v1/checks", {
      method: "POST",
      headers: {
        "Truora-API-Key": process.env.TRUORA_API_KEY ?? "",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ country: "CO", type: "person", user_authorized: "true" }),
    });
    if (!res.ok) throw new Error(`Truora falló: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { check: { check_id: string } };
    const checkId = json.check.check_id;
    await db.update(usuarios).set({ kycProveedorId: checkId }).where(eq(usuarios.id, usuarioId));
    return { checkId };
  },
  // El webhook de Truora entrega el score → se traduce a aprobado/no y pasa
  // por el MISMO núcleo (lista negra incluida).
  procesarResultado: aplicarResultado,
};

export function obtenerKyc(): ProveedorKYC {
  return (process.env.KYC_DRIVER ?? "simulado") === "truora" ? truora : simulado;
}
