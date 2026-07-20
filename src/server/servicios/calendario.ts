import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { calendarioDias, propiedades } from "../db/schema";

/**
 * Escritura del calendario — regla #14: SOLO el propietario de la propiedad
 * bloquea/libera días, y JAMÁS puede tocar días `reservado_app` (los bloqueó
 * el dinero) ni `bloqueado_ical` (los gobierna la sincronización externa).
 * La regla vive en el WHERE del SQL: un cliente modificado no puede saltársela.
 */

export class CalendarioError extends Error {}

async function exigirPropiedadDe(db: Db, propietarioId: string, propiedadId: string): Promise<void> {
  const [p] = await db
    .select({ id: propiedades.id })
    .from(propiedades)
    .where(and(eq(propiedades.id, propiedadId), eq(propiedades.propietarioId, propietarioId)))
    .limit(1);
  if (!p) throw new CalendarioError("La propiedad no existe o no te pertenece");
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function validarFechas(fechas: string[]): void {
  if (fechas.length === 0 || fechas.length > 92) {
    throw new CalendarioError("Rango de días inválido (1–92)");
  }
  for (const f of fechas) {
    if (!RE_FECHA.test(f)) throw new CalendarioError(`Fecha inválida: ${f}`);
  }
}

/**
 * Bloqueo manual. Upsert por día: un día sin fila cuenta como disponible; el
 * ON CONFLICT solo actualiza si el estado actual es 'disponible'.
 * Devuelve cuántos días quedaron bloqueados (los intocables se ignoran).
 */
export async function bloquearDias(
  db: Db,
  propietarioId: string,
  propiedadId: string,
  fechas: string[],
): Promise<number> {
  await exigirPropiedadDe(db, propietarioId, propiedadId);
  validarFechas(fechas);
  let bloqueados = 0;
  for (const fecha of fechas) {
    const r = await db
      .insert(calendarioDias)
      .values({ propiedadId, fecha, estado: "bloqueado_manual" })
      .onConflictDoUpdate({
        target: [calendarioDias.propiedadId, calendarioDias.fecha],
        set: { estado: sql`'bloqueado_manual'::estado_dia`, actualizadoEn: sql`now()` },
        setWhere: sql`${calendarioDias.estado} = 'disponible'`,
      })
      .returning({ estado: calendarioDias.estado });
    if (r[0]?.estado === "bloqueado_manual") bloqueados++;
  }
  return bloqueados;
}

/** Liberar bloqueo manual. Solo transición bloqueado_manual → disponible. */
export async function liberarDias(
  db: Db,
  propietarioId: string,
  propiedadId: string,
  fechas: string[],
): Promise<number> {
  await exigirPropiedadDe(db, propietarioId, propiedadId);
  validarFechas(fechas);
  const r = await db
    .update(calendarioDias)
    .set({ estado: "disponible", actualizadoEn: sql`now()` })
    .where(
      and(
        eq(calendarioDias.propiedadId, propiedadId),
        inArray(calendarioDias.fecha, fechas),
        eq(calendarioDias.estado, "bloqueado_manual"),
      ),
    )
    .returning({ fecha: calendarioDias.fecha });
  return r.length;
}
