import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db";
import { otps, sesiones, usuarios } from "../db/schema";
import { sha256Hex, tokenAleatorio, verificarTotp } from "../crypto";
import { obtenerEmail } from "../adaptadores/email";

/**
 * Auth propia: OTP por email (passwordless) + sesiones opacas con cookie
 * httpOnly. El token viaja solo en la cookie; en DB vive únicamente su hash.
 * 2FA TOTP obligatorio para elevar a admin.
 */

export const COOKIE_SESION = "estadia_sesion";
const OTP_VIGENCIA_MIN = 10;
const OTP_MAX_INTENTOS = 5;
const OTP_MAX_POR_HORA = 5;
const SESION_DIAS = 14;

export class AuthError extends Error {}

/** Paso 1: solicitar código. Rate limit por email (fuerza bruta). */
export async function solicitarOtp(db: Db, email: string): Promise<void> {
  const normalizado = email.trim().toLowerCase();
  const [{ recientes }] = await db
    .select({ recientes: sql<number>`count(*)::int` })
    .from(otps)
    .where(and(eq(otps.email, normalizado), gt(otps.creadoEn, sql`now() - interval '1 hour'`)));
  if (recientes >= OTP_MAX_POR_HORA) {
    throw new AuthError("Demasiados códigos solicitados. Intenta en una hora.");
  }

  const codigo = String(Math.floor(Math.random() * 900_000) + 100_000);
  await db.insert(otps).values({
    email: normalizado,
    codigoHash: sha256Hex(codigo),
    venceEn: sql`now() + interval '${sql.raw(String(OTP_VIGENCIA_MIN))} minutes'` as unknown as Date,
  });
  await obtenerEmail().enviar(
    db,
    normalizado,
    "Tu código de acceso a THE CIRCLE",
    `Tu código es ${codigo}. Vence en ${OTP_VIGENCIA_MIN} minutos. Nunca lo compartas.`,
  );
}

/** Paso 2: verificar código → crear sesión. Solo usuarios registrados y no baneados. */
export async function verificarOtpYCrearSesion(
  db: Db,
  email: string,
  codigo: string,
): Promise<{ token: string; venceEn: Date }> {
  const normalizado = email.trim().toLowerCase();

  return await db.transaction(async (tx) => {
    const [otp] = await tx
      .select()
      .from(otps)
      .where(
        and(eq(otps.email, normalizado), eq(otps.usado, false), gt(otps.venceEn, sql`now()`)),
      )
      .orderBy(sql`creado_en DESC`)
      .limit(1)
      .for("update");

    if (!otp) throw new AuthError("Código vencido o inexistente. Solicita uno nuevo.");
    if (otp.intentos >= OTP_MAX_INTENTOS) throw new AuthError("Demasiados intentos. Solicita un código nuevo.");

    if (otp.codigoHash !== sha256Hex(codigo.trim())) {
      await tx.update(otps).set({ intentos: otp.intentos + 1 }).where(eq(otps.id, otp.id));
      throw new AuthError("Código incorrecto.");
    }
    await tx.update(otps).set({ usado: true }).where(eq(otps.id, otp.id));

    const [usuario] = await tx.select().from(usuarios).where(eq(usuarios.email, normalizado));
    if (!usuario) throw new AuthError("No existe una cuenta con este correo. Regístrate primero.");
    if (usuario.estado === "baneado") throw new AuthError("Esta cuenta fue suspendida de forma permanente.");

    const token = tokenAleatorio();
    const venceEn = new Date(Date.now() + SESION_DIAS * 86_400_000);
    await tx.insert(sesiones).values({ tokenHash: sha256Hex(token), usuarioId: usuario.id, venceEn });
    return { token, venceEn };
  });
}

export interface UsuarioSesion {
  id: string;
  email: string;
  roles: string[];
  estado: string;
  adminElevada: boolean;
}

export async function validarSesion(db: Db, token: string | undefined): Promise<UsuarioSesion | null> {
  if (!token) return null;
  const filas = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      roles: usuarios.roles,
      estado: usuarios.estado,
      adminElevada: sesiones.adminElevada,
    })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(and(eq(sesiones.tokenHash, sha256Hex(token)), gt(sesiones.venceEn, sql`now()`)));
  const u = filas[0];
  if (!u || u.estado === "baneado") return null; // ban = cierre de sesión inmediato
  return u;
}

export async function cerrarSesion(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sesiones).where(eq(sesiones.tokenHash, sha256Hex(token)));
}

/** Cierra TODAS las sesiones de un usuario (lo usa el ban automático). */
export async function cerrarSesionesDe(db: Db, usuarioId: string): Promise<void> {
  await db.delete(sesiones).where(eq(sesiones.usuarioId, usuarioId));
}

// ─── Guards ──────────────────────────────────────────────────────────────────

export type Seccion = "propietario" | "principal" | "externo" | "admin";

/** Regla de acceso por sección — pura y testeable. Admin entra a todo. */
export function puedeAccederSeccion(roles: string[], seccion: Seccion): boolean {
  if (roles.includes("admin")) return true;
  return roles.includes(seccion);
}

export function exigirRol(usuario: UsuarioSesion | null, seccion: Seccion): UsuarioSesion {
  if (!usuario) throw new AuthError("Sesión requerida.");
  if (usuario.estado !== "activo") throw new AuthError("Tu cuenta aún no está verificada (KYC pendiente).");
  if (!puedeAccederSeccion(usuario.roles, seccion)) throw new AuthError("No tienes acceso a esta sección.");
  return usuario;
}

/** Admin exige, además del rol, la elevación 2FA (TOTP) de ESTA sesión. */
export function exigirAdmin(usuario: UsuarioSesion | null): UsuarioSesion {
  const u = exigirRol(usuario, "admin");
  if (!u.adminElevada) throw new AuthError("Se requiere segundo factor (TOTP).");
  return u;
}

export async function elevarAdmin(db: Db, token: string, codigoTotp: string): Promise<void> {
  const usuario = await validarSesion(db, token);
  if (!usuario || !usuario.roles.includes("admin")) throw new AuthError("No autorizado.");
  const [fila] = await db
    .select({ totpSecret: usuarios.totpSecret })
    .from(usuarios)
    .where(eq(usuarios.id, usuario.id));
  if (!fila?.totpSecret) throw new AuthError("Este admin no tiene TOTP configurado.");
  if (!verificarTotp(fila.totpSecret, codigoTotp)) throw new AuthError("Código TOTP inválido.");
  await db
    .update(sesiones)
    .set({ adminElevada: true })
    .where(eq(sesiones.tokenHash, sha256Hex(token)));
}

/** Flag de entorno: la demo pública corre sin auth; con DB se exige. */
export function authExigida(): boolean {
  return process.env.MODO_AUTH === "exigida";
}
