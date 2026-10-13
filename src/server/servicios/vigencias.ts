import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "../db";
import { linksDePago, negociaciones, ofertas, reservas, solicitudes } from "../db/schema";
import { transicionarReserva } from "./reservas";

/**
 * Housekeeping de vigencias (cron): lo vencido se MARCA vencido para que la
 * verdad viva en la DB, no solo en los WHERE de lectura.
 * - solicitud pendiente vencida → expirada
 * - oferta activa vencida → expirada
 * - link activo vencido → expirado; si era el link 1, la reserva EXPIRA
 *   (auditada, actor 'sistema') y las fechas siguen libres — sin holds.
 * - link 1 INVALIDADO (perdió la carrera) con la reserva aún en
 *   LINK_1_ENVIADO → la reserva pasa a INVALIDADA (rescata zombis antiguos).
 * - negociación sin oferta activa y sin actividad > 48 h → reserva EXPIRADA
 *   y negociación cerrada.
 * - purga en lotes de sesiones y OTPs vencidos hace más de 1 día.
 * Las validaciones DURAS (webhook/aceptar) no dependen de este job.
 */

/** Tope de transiciones de reserva por corrida (el cron corre cada 10 min). */
const LOTE_RESERVAS = 500;
/** Tope de filas purgadas por tabla y corrida. */
const LOTE_PURGA = 5000;
/** Inactividad máxima de una negociación sin oferta viva. */
const HORAS_NEGOCIACION_INACTIVA = 48;

export async function expirarVigencias(db: Db): Promise<{
  solicitudes: number;
  ofertas: number;
  links: number;
  reservasExpiradas: number;
  reservasInvalidadas: number;
  negociacionesExpiradas: number;
  completadas: number;
  sesionesPurgadas: number;
  otpsPurgados: number;
}> {
  const ahora = sql`now()`;

  const solVencidas = await db
    .update(solicitudes)
    .set({ estado: "expirada" })
    .where(and(eq(solicitudes.estado, "pendiente"), lt(solicitudes.venceEn, ahora)))
    .returning({ id: solicitudes.id });

  const ofVencidas = await db
    .update(ofertas)
    .set({ estado: "expirada" })
    .where(and(eq(ofertas.estado, "activa"), lt(ofertas.venceEn, ahora)))
    .returning({ id: ofertas.id });

  const linksVencidos = await db
    .update(linksDePago)
    .set({ estado: "expirado" })
    .where(and(eq(linksDePago.estado, "activo"), lt(linksDePago.venceEn, ahora)))
    .returning({ id: linksDePago.id, reservaId: linksDePago.reservaId, mitad: linksDePago.mitad });

  // RE-ENTRANTE: las reservas a cerrar se derivan de una CONSULTA (reserva en
  // LINK_1_ENVIADO cuyo link 1 esté expirado o invalidado), no del returning
  // del UPDATE de arriba — si una corrida anterior murió a mitad del loop,
  // esta las rescata. El saldo vencido (mitad 2) se regenera, no expira reserva.
  const paraCerrar = await db
    .select({ id: reservas.id, estadoLink: linksDePago.estado })
    .from(reservas)
    .innerJoin(linksDePago, eq(linksDePago.reservaId, reservas.id))
    .where(
      and(
        eq(reservas.estado, "LINK_1_ENVIADO"),
        eq(linksDePago.mitad, 1),
        inArray(linksDePago.estado, ["expirado", "invalidado"]),
      ),
    )
    .limit(LOTE_RESERVAS);
  let reservasExpiradas = 0;
  let reservasInvalidadas = 0;
  for (const r of paraCerrar) {
    try {
      if (r.estadoLink === "invalidado") {
        await transicionarReserva(db, r.id, "INVALIDADA", "sistema", { motivo: "link_1_invalidado" });
        reservasInvalidadas++;
      } else {
        await transicionarReserva(db, r.id, "EXPIRADA", "sistema", { motivo: "link_1_vencido" });
        reservasExpiradas++;
      }
    } catch (e) {
      // Una reserva atascada jamás frena el resto del barrido.
      console.error(`[vigencias] no se pudo cerrar reserva ${r.id}:`, e);
    }
  }

  // Negociaciones abandonadas: reserva en NEGOCIACION, sin oferta activa
  // vigente y sin actividad (última oferta o creación) en más de 48 h.
  const abandonadas = await db
    .select({ reservaId: reservas.id, negociacionId: negociaciones.id })
    .from(reservas)
    .innerJoin(negociaciones, eq(negociaciones.solicitudId, reservas.solicitudId))
    .where(
      and(
        eq(reservas.estado, "NEGOCIACION"),
        eq(negociaciones.estado, "abierta"),
        sql`NOT EXISTS (
          SELECT 1 FROM ofertas o
          WHERE o.negociacion_id = ${negociaciones.id} AND o.estado = 'activa' AND o.vence_en > now())`,
        sql`GREATEST(
          ${reservas.creadaEn},
          coalesce((SELECT max(o.creada_en) FROM ofertas o WHERE o.negociacion_id = ${negociaciones.id}), ${reservas.creadaEn})
        ) < now() - (${HORAS_NEGOCIACION_INACTIVA} * interval '1 hour')`,
      ),
    )
    .limit(LOTE_RESERVAS);
  let negociacionesExpiradas = 0;
  for (const a of abandonadas) {
    try {
      const cerrada = await db.transaction(async (tx) => {
        // Mismo orden de locks que aceptar/contraofertar: negociación primero.
        const [neg] = await tx
          .select({ estado: negociaciones.estado })
          .from(negociaciones)
          .where(eq(negociaciones.id, a.negociacionId))
          .for("update");
        if (neg?.estado !== "abierta") return false;
        const [viva] = await tx
          .select({ id: ofertas.id })
          .from(ofertas)
          .where(
            and(
              eq(ofertas.negociacionId, a.negociacionId),
              eq(ofertas.estado, "activa"),
              sql`${ofertas.venceEn} > now()`,
            ),
          )
          .limit(1);
        if (viva) return false; // alguien ofertó entre la consulta y el lock
        await tx
          .update(ofertas)
          .set({ estado: "expirada" })
          .where(and(eq(ofertas.negociacionId, a.negociacionId), eq(ofertas.estado, "activa")));
        await tx
          .update(negociaciones)
          .set({ estado: "expirada" })
          .where(eq(negociaciones.id, a.negociacionId));
        await transicionarReserva(tx as unknown as Db, a.reservaId, "EXPIRADA", "sistema", {
          motivo: "negociacion_inactiva",
        });
        return true;
      });
      if (cerrada) negociacionesExpiradas++;
    } catch (e) {
      console.error(`[vigencias] no se pudo expirar negociación ${a.negociacionId}:`, e);
    }
  }

  // Check-in hecho y fecha de salida pasada → la reserva se completa sola.
  // El día se compara en HORA COLOMBIA: CURRENT_DATE del servidor (UTC) rueda
  // a las 7 pm de Bogotá y completaría reservas 5 horas antes de terminar el día.
  const enCheckIn = await db
    .select({ id: reservas.id })
    .from(reservas)
    .where(
      and(
        eq(reservas.estado, "CHECK_IN"),
        lt(reservas.hasta, sql`(now() AT TIME ZONE 'America/Bogota')::date`),
      ),
    )
    .limit(LOTE_RESERVAS);
  let completadas = 0;
  for (const r of enCheckIn) {
    try {
      await transicionarReserva(db, r.id, "COMPLETADA", "sistema", { motivo: "salida_cumplida" });
      completadas++;
    } catch (e) {
      console.error(`[vigencias] no se pudo completar reserva ${r.id}:`, e);
    }
  }

  // Purga en lotes (ctid + LIMIT): sesiones y OTPs vencidos hace > 1 día no
  // sirven para nada y solo engordan las tablas de auth.
  const sesionesPurgadas = await purgarLote(
    db,
    sql`DELETE FROM sesiones WHERE ctid IN (
      SELECT ctid FROM sesiones WHERE vence_en < now() - interval '1 day' LIMIT ${LOTE_PURGA})`,
  );
  const otpsPurgados = await purgarLote(
    db,
    sql`DELETE FROM otps WHERE ctid IN (
      SELECT ctid FROM otps WHERE vence_en < now() - interval '1 day' LIMIT ${LOTE_PURGA})`,
  );

  return {
    solicitudes: solVencidas.length,
    ofertas: ofVencidas.length,
    links: linksVencidos.length,
    reservasExpiradas,
    reservasInvalidadas,
    negociacionesExpiradas,
    completadas,
    sesionesPurgadas,
    otpsPurgados,
  };
}

async function purgarLote(db: Db, consulta: ReturnType<typeof sql>): Promise<number> {
  try {
    const r = (await db.execute(consulta)) as unknown as { count?: number };
    return r.count ?? 0;
  } catch (e) {
    // La purga jamás tumba el barrido de vigencias.
    console.error("[vigencias] purga falló:", e);
    return 0;
  }
}
