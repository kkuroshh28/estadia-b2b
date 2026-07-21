import { eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  configuracionPlataforma,
  linksDePago,
  negociaciones,
  ofertas,
  reservas,
} from "../db/schema";
import { centavos, liquidarReserva, type Centavos } from "@/lib/dinero";

/**
 * Regla #6: el link de pago se genera EXCLUSIVAMENTE del precio aceptado por
 * ambos en el módulo de negociación. No existe ningún camino de código que
 * cree un link con monto manual: este servicio es la única puerta, y toma el
 * monto de la OFERTA ACEPTADA en base de datos — jamás de un parámetro.
 */

export interface PisoComision {
  activo: boolean;
  pct: number; // ej. 0.08 = neta + 8%
}

/** Lee el piso de configuración (regla #8: programado, apagado al lanzamiento). */
export async function obtenerPisoComision(db: Db): Promise<PisoComision> {
  const [fila] = await db
    .select()
    .from(configuracionPlataforma)
    .where(eq(configuracionPlataforma.clave, "piso_comision"));
  const valor = (fila?.valor ?? {}) as { activo?: boolean; pct?: number };
  return { activo: valor.activo ?? false, pct: valor.pct ?? 0 };
}

/** Validación de una propuesta contra tarifa neta y piso (si está encendido). */
export function validarPropuestaServidor(
  montoCentavos: Centavos,
  tarifaNetaCentavos: Centavos,
  piso: PisoComision,
): { valida: boolean; motivo?: string } {
  if (montoCentavos < tarifaNetaCentavos) {
    return {
      valida: false,
      motivo: "El precio no puede ser inferior a la tarifa neta del propietario.",
    };
  }
  if (piso.activo) {
    // pct llega de config como decimal; se convierte a bps enteros para no
    // comparar con flotantes.
    const bps = Math.round(piso.pct * 10_000);
    const minimo = tarifaNetaCentavos + Math.ceil((tarifaNetaCentavos * bps) / 10_000);
    if (montoCentavos < minimo) {
      return {
        valida: false,
        motivo: `Piso de comisión activo: el precio debe ser ≥ tarifa neta + ${piso.pct * 100}%.`,
      };
    }
  }
  return { valida: true };
}

export class OfertaNoAceptableError extends Error {}

/**
 * Acepta una oferta y genera el Link 1 en la MISMA transacción.
 * El monto del link sale de liquidarReserva(precio de la oferta aceptada):
 * imposible digitarlo distinto.
 */
export async function aceptarOfertaYGenerarLink(
  db: Db,
  ofertaId: string,
  aceptanteId: string,
): Promise<{ linkId: string; montoCentavos: number }> {
  // Vigencia ANTES de la transacción: si venció, la marca debe sobrevivir
  // (dentro de la tx el throw la revertiría).
  const [previa] = await db.select().from(ofertas).where(eq(ofertas.id, ofertaId));
  if (previa && previa.estado === "activa" && previa.venceEn.getTime() < Date.now()) {
    await db.update(ofertas).set({ estado: "expirada" }).where(eq(ofertas.id, ofertaId));
    throw new OfertaNoAceptableError("La oferta venció: pide una nueva propuesta.");
  }
  return await db.transaction(async (tx) => {
    const [oferta] = await tx
      .select()
      .from(ofertas)
      .where(eq(ofertas.id, ofertaId))
      .for("update");
    if (!oferta || oferta.estado !== "activa") {
      throw new OfertaNoAceptableError("La oferta no está activa (expiró o fue contraofertada).");
    }
    if (oferta.emisorId === aceptanteId) {
      throw new OfertaNoAceptableError("No puedes aceptar tu propia oferta.");
    }

    const [neg] = await tx
      .select()
      .from(negociaciones)
      .where(eq(negociaciones.id, oferta.negociacionId))
      .for("update");
    if (!neg || neg.estado !== "abierta") {
      throw new OfertaNoAceptableError("La negociación no está abierta.");
    }

    const piso = await obtenerPisoComision(tx as unknown as Db);
    const validacion = validarPropuestaServidor(
      centavos(oferta.montoCentavos),
      centavos(neg.tarifaNetaCentavos),
      piso,
    );
    if (!validacion.valida) throw new OfertaNoAceptableError(validacion.motivo);

    await tx
      .update(ofertas)
      .set({ estado: "aceptada" })
      .where(eq(ofertas.id, ofertaId));
    await tx
      .update(negociaciones)
      .set({ estado: "acordada", precioAcordadoCentavos: oferta.montoCentavos })
      .where(eq(negociaciones.id, neg.id));

    // La reserva asociada toma el precio EXACTO de la oferta aceptada
    const [reserva] = await tx
      .select()
      .from(reservas)
      .where(eq(reservas.solicitudId, neg.solicitudId))
      .for("update");
    if (!reserva) throw new OfertaNoAceptableError("Reserva no encontrada para la negociación.");

    await tx
      .update(reservas)
      .set({ precioFinalCentavos: oferta.montoCentavos })
      .where(eq(reservas.id, reserva.id));

    const liq = liquidarReserva(
      centavos(oferta.montoCentavos),
      centavos(neg.tarifaNetaCentavos),
    );
    const monto1 = liq.mitades[0].montoCliente;

    const [link] = await tx
      .insert(linksDePago)
      .values({
        reservaId: reserva.id,
        mitad: 1,
        montoCentavos: monto1,
        url: `/pago/${crypto.randomUUID()}`,
        venceEn: sql`now() + interval '24 hours'` as unknown as Date,
      })
      .returning({ id: linksDePago.id, montoCentavos: linksDePago.montoCentavos });

    return { linkId: link.id, montoCentavos: link.montoCentavos };
  });
}
