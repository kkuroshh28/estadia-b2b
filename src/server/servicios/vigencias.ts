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

  let reservasExpiradas = 0;
  for (const l of linksVencidos) {
    if (l.mitad !== 1) continue; // saldo vencido: el externo puede regenerarlo
    const [r] = await db
      .select({ estado: reservas.estado })
      .from(reservas)
      .where(eq(reservas.id, l.reservaId));
    if (r?.estado === "LINK_1_ENVIADO") {
      await transicionarReserva(db, l.reservaId, "EXPIRADA", "sistema", {
        motivo: "link_1_vencido",
      });
      reservasExpiradas++;
    }
  }

  // Check-in hecho y fecha de salida pasada → la reserva se completa sola.
  const enCheckIn = await db
    .select({ id: reservas.id })
    .from(reservas)
    .where(and(eq(reservas.estado, "CHECK_IN"), lt(reservas.hasta, sql`CURRENT_DATE`)));
  let completadas = 0;
  for (const r of enCheckIn) {
    await transicionarReserva(db, r.id, "COMPLETADA", "sistema", { motivo: "salida_cumplida" });
    completadas++;
  }

  return {
    solicitudes: solVencidas.length,
    ofertas: ofVencidas.length,
    links: linksVencidos.length,
    reservasExpiradas,
    completadas,
  };
}
