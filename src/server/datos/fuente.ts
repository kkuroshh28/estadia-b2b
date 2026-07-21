import { asc, sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import { alias as tablaAlias, usuarios } from "../db/schema";
import { authExigida, type Seccion, type UsuarioSesion } from "../auth";
import { protegerSeccion } from "../auth/guardia";

/**
 * Resolución de la fuente de datos de los paneles /app:
 * - Sin DATABASE_URL → demo pública (los constructores de demo-paneles).
 * - Con DB y sesión real → datos del usuario de la sesión.
 * - Con DB sin sesión (dev/preview con seed) → primer usuario del rol.
 *
 * Política de fallos: con MODO_AUTH=exigida un error de DB NUNCA degrada a
 * demo (jamás mostrar datos falsos a un usuario real); sin auth exigida la
 * demo pública no se cae por un problema de DB.
 */

export function hayDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export interface UsuarioPanel {
  id: string;
  alias: string | null;
}

/** Usuario cuyo panel se muestra (sesión real, o usuario semilla del rol). */
export async function usuarioDelPanel(
  db: Db,
  seccion: Seccion,
  sesion: UsuarioSesion | null,
): Promise<UsuarioPanel | null> {
  if (sesion) {
    const a = await db
      .select({ alias: tablaAlias.alias })
      .from(tablaAlias)
      .where(sql`${tablaAlias.usuarioId} = ${sesion.id} AND NOT ${tablaAlias.retirado}`)
      .limit(1);
    return { id: sesion.id, alias: a[0]?.alias ?? null };
  }
  // Dev/preview sin sesión: usuario activo del rol, prefiriendo los del seed
  // (demo.*@estadia.demo) sobre restos de tests que compartan la DB.
  const u = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(sql`${seccion} = ANY(${usuarios.roles}) AND ${usuarios.estado} = 'activo'`)
    .orderBy(sql`(${usuarios.email} LIKE 'demo.%@estadia.demo') DESC`, asc(usuarios.creadoEn))
    .limit(1);
  if (!u[0]) return null;
  const a = await db
    .select({ alias: tablaAlias.alias })
    .from(tablaAlias)
    .where(sql`${tablaAlias.usuarioId} = ${u[0].id} AND NOT ${tablaAlias.retirado}`)
    .limit(1);
  return { id: u[0].id, alias: a[0]?.alias ?? null };
}

/**
 * Resuelve los datos de un panel: DB si hay, demo si no (o si la DB falla y
 * NO estamos en modo auth exigida).
 */
export async function resolverPanel<T>(
  seccion: Seccion,
  demo: () => T,
  real: (db: Db, usuario: UsuarioPanel) => Promise<T>,
): Promise<T> {
  const sesion = await protegerSeccion(seccion);
  if (!hayDb()) return demo();
  try {
    const db = obtenerDb();
    const usuario = await usuarioDelPanel(db, seccion, sesion);
    if (!usuario) return demo(); // DB vacía (sin seed): demo
    return await real(db, usuario);
  } catch (e) {
    if (authExigida()) throw e;
    console.error(`[datos] panel ${seccion} → fallback demo:`, e);
    return demo();
  }
}

/**
 * Actor de una petición de ESCRITURA para un rol dado:
 * - MODO_AUTH=exigida → sesión válida con ese rol, o null (401 en el handler).
 * - dev/preview sin auth → el usuario del panel de ese rol (semilla).
 */
export async function actorDePeticion(db: Db, rol: Seccion): Promise<UsuarioPanel | null> {
  if (authExigida()) {
    const { usuarioDePeticion } = await import("../auth/guardia");
    const sesion = await usuarioDePeticion();
    if (!sesion || !sesion.roles.includes(rol)) return null;
    return usuarioDelPanel(db, rol, sesion);
  }
  return usuarioDelPanel(db, rol, null);
}

/**
 * Admin de DESARROLLO: solo cuando MODO_AUTH no está exigido. Se materializa
 * como usuario real (la auditoría admin tiene FK a usuarios) con sesión
 * "elevada" sintética. En producción con auth, esto jamás se usa.
 */
export async function adminDev(db: Db): Promise<UsuarioSesion | null> {
  if (authExigida()) return null;
  const { usuarios } = await import("../db/schema");
  const email = "admin@thecircle.dev";
  const [existente] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(sql`${usuarios.email} = ${email}`);
  let id = existente?.id;
  if (!id) {
    const [nuevo] = await db
      .insert(usuarios)
      .values({
        nombreReal: "Admin Dev",
        cedulaHash: "admin-dev",
        cedulaCifrada: "admin-dev",
        email,
        telefonoCifrado: "admin-dev",
        roles: ["admin"],
        estado: "activo",
      })
      .onConflictDoNothing()
      .returning({ id: usuarios.id });
    id = nuevo?.id;
  }
  if (!id) return null;
  return { id, email, roles: ["admin"], estado: "activo", adminElevada: true } as UsuarioSesion;
}

/** matiz determinista 0–359 desde un uuid (carátulas generadas, sin fotos). */
export function matizDeId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
