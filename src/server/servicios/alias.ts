import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { alias as tablaAlias } from "../db/schema";
import { generarAlias } from "@/lib/domain/alias";

const MAX_INTENTOS = 20;

/**
 * Asigna un alias único global al usuario. La unicidad la garantiza la BASE
 * (PK sobre alias): bajo concurrencia, dos generaciones iguales chocan y el
 * perdedor reintenta con otro alias. Un alias retirado JAMÁS se reasigna
 * (la fila nunca se borra; retirado=true la deja quemada para siempre).
 */
export async function asignarAliasUnico(db: Db, usuarioId: string): Promise<string> {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const candidato = generarAlias();
    const avatarId = Math.floor(Math.random() * 24);
    try {
      await db.insert(tablaAlias).values({
        alias: candidato,
        usuarioId,
        avatarId,
      });
      return candidato;
    } catch (e) {
      if (esViolacionUnicidad(e)) continue; // colisión: reintenta con otro
      throw e;
    }
  }
  throw new Error("No fue posible generar un alias único tras varios intentos");
}

/** Retiro permanente: el alias queda quemado (ban o cierre de cuenta). */
export async function retirarAlias(db: Db, alias: string): Promise<void> {
  await db.execute(
    sql`UPDATE alias
        SET retirado = true, retirado_en = now(), usuario_id = NULL
        WHERE alias = ${alias} AND NOT retirado`,
  );
}

function esViolacionUnicidad(e: unknown): boolean {
  // Drizzle envuelve el PostgresError original en `cause` (a veces anidado).
  let actual = e as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; actual && i < 5; i++) {
    if (actual.code === "23505") return true;
    actual = actual.cause as { code?: string; cause?: unknown } | undefined;
  }
  return false;
}

/** Garantiza que un usuario tenga alias activo (dueños antiguos sin alias). */
export async function asegurarAlias(db: Db, usuarioId: string): Promise<string> {
  const [existente] = await db.execute(
    sql`SELECT alias FROM alias WHERE usuario_id = ${usuarioId} AND NOT retirado LIMIT 1`,
  ) as unknown as [{ alias: string } | undefined];
  if (existente?.alias) return existente.alias;
  return asignarAliasUnico(db, usuarioId);
}

/**
 * Fija un alias ELEGIDO (superadmin). El alias anterior queda retirado y
 * quemado para siempre; si el elegido ya existe (de otro o retirado), falla.
 */
export async function fijarAlias(db: Db, usuarioId: string, elegido: string): Promise<string> {
  if (!/^[A-Z]+-\d{2,4}$/.test(elegido)) throw new Error(`Alias inválido: ${elegido} (formato NOMBRE-123).`);
  return await db.transaction(async (tx) => {
    const [actual] = (await tx.execute(
      sql`SELECT alias FROM alias WHERE usuario_id = ${usuarioId} AND NOT retirado LIMIT 1`,
    )) as unknown as [{ alias: string } | undefined];
    if (actual?.alias === elegido) return elegido;
    if (actual?.alias) await retirarAlias(tx as unknown as Db, actual.alias);
    try {
      await tx.insert(tablaAlias).values({ alias: elegido, usuarioId, avatarId: Math.floor(Math.random() * 24) });
    } catch (e) {
      if (esViolacionUnicidad(e)) throw new Error(`El alias ${elegido} ya existe o fue retirado.`);
      throw e;
    }
    return elegido;
  });
}
