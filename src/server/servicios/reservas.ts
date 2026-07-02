import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { auditoriaReservas, reservas } from "../db/schema";
import { puedeTransicionar } from "@/lib/domain/reserva";
import type { EstadoReserva } from "@/lib/domain/tipos";

export class TransicionInvalidaError extends Error {
  constructor(desde: EstadoReserva, hacia: EstadoReserva) {
    super(`Transición inválida: ${desde} → ${hacia}`);
  }
}

/**
 * ÚNICA puerta de cambio de estado de una reserva (las transiciones jamás
 * ocurren desde el cliente). Valida contra la matriz, escribe la auditoría
 * append-only (actor, anterior → nuevo) y todo dentro de la transacción dada.
 */
export async function transicionarReserva(
  db: Db,
  reservaId: string,
  hacia: EstadoReserva,
  actor: string,
  detalle?: Record<string, unknown>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [reserva] = await tx
      .select({ estado: reservas.estado })
      .from(reservas)
      .where(eq(reservas.id, reservaId))
      .for("update");

    if (!reserva) throw new Error(`Reserva no encontrada: ${reservaId}`);
    const desde = reserva.estado as EstadoReserva;
    if (!puedeTransicionar(desde, hacia)) {
      throw new TransicionInvalidaError(desde, hacia);
    }

    await tx.update(reservas).set({ estado: hacia }).where(eq(reservas.id, reservaId));
    await tx.insert(auditoriaReservas).values({
      reservaId,
      actor,
      estadoAnterior: desde,
      estadoNuevo: hacia,
      detalle: detalle ?? null,
    });
  });
}

/**
 * "El primero que acepta gana" (solicitudes): UPDATE condicional atómico.
 * Devuelve true si ESTE principal ganó la solicitud; false si alguien llegó antes.
 */
export async function aceptarSolicitud(
  db: Db,
  solicitudId: string,
  principalId: string,
): Promise<boolean> {
  const resultado = await db.execute(
    // Un solo statement: imposible que dos ganen. El segundo afecta 0 filas.
    dbSql`UPDATE solicitudes
          SET principal_aceptante_id = ${principalId}, estado = 'aceptada'
          WHERE id = ${solicitudId}
            AND principal_aceptante_id IS NULL
            AND estado = 'pendiente'
            AND vence_en > now()`,
  );
  return extraerFilasAfectadas(resultado) === 1;
}

// drizzle-orm expone sql desde el paquete raíz
import { sql as dbSql } from "drizzle-orm";

function extraerFilasAfectadas(resultado: unknown): number {
  // postgres-js devuelve un array con .count; cubrimos ambas formas.
  const r = resultado as { count?: number; rowCount?: number };
  return r.count ?? r.rowCount ?? 0;
}
