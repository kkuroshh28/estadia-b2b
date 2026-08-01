import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "../db";
import { linksDePago, ofertas, reservas, solicitudes } from "../db/schema";
import { transicionarReserva } from "./reservas";

/**
 * Housekeeping de vigencias (cron): lo vencido se MARCA vencido para que la
 * verdad viva en la DB, no solo en los WHERE de lectura.
 * - solicitud pendiente vencida → expirada
 * - oferta activa vencida → expirada
 * - link activo vencido → expirado; si era el link 1, la reserva EXPIRA
 *   (auditada, actor 'sistema') y las fechas siguen libres — sin holds.
 * Las validaciones DURAS (webhook/aceptar) no dependen de este job.
 */
export async function expirarVigencias(db: Db): Promise<{
  solicitudes: number;
  ofertas: number;
  links: number;
  reservasExpiradas: number;
  completadas: number;
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

  // RE-ENTRANTE: las reservas a expirar se derivan de una CONSULTA (reserva en
  // LINK_1_ENVIADO cuyo link 1 esté expirado), no del returning del UPDATE de
  // arriba — si una corrida anterior murió a mitad del loop, esta las rescata.
  // El saldo vencido (mitad 2) se regenera, no expira reserva.
  const paraExpirar = await db
    .select({ id: reservas.id })
    .from(reservas)
    .innerJoin(linksDePago, eq(linksDePago.reservaId, reservas.id))
    .where(
      and(
        eq(reservas.estado, "LINK_1_ENVIADO"),
        eq(linksDePago.mitad, 1),
        eq(linksDePago.estado, "expirado"),
      ),
    );
  let reservasExpiradas = 0;
  for (const r of paraExpirar) {
    try {
      await transicionarReserva(db, r.id, "EXPIRADA", "sistema", { motivo: "link_1_vencido" });
      reservasExpiradas++;
    } catch (e) {
      // Una reserva atascada jamás frena el resto del barrido.
      console.error(`[vigencias] no se pudo expirar reserva ${r.id}:`, e);
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
    );
  let completadas = 0;
  for (const r of enCheckIn) {
    try {
      await transicionarReserva(db, r.id, "COMPLETADA", "sistema", { motivo: "salida_cumplida" });
      completadas++;
    } catch (e) {
      console.error(`[vigencias] no se pudo completar reserva ${r.id}:`, e);
    }
  }

  return {
    solicitudes: solVencidas.length,
    ofertas: ofVencidas.length,
    links: linksVencidos.length,
    reservasExpiradas,
    completadas,
  };
}
