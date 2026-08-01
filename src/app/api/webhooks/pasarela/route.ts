import { NextResponse } from "next/server";
import { obtenerDb } from "@/server/db";
import { obtenerPasarela, FirmaInvalidaError } from "@/server/adaptadores/pasarela";
import { procesarWebhookPago, transicionPostPago } from "@/server/servicios/pagos";
import { notificarPagoConfirmado } from "@/server/servicios/notificaciones";
import { generarContrato } from "@/server/servicios/contratos";
import { eq } from "drizzle-orm";
import { linksDePago } from "@/server/db/schema";

/**
 * ÚNICA entrada de confirmación de pago — real o simulada, el MISMO camino:
 * verificación de firma → idempotencia → transacción del dinero → transición.
 * Nada de polling.
 */
export async function POST(req: Request) {
  const cuerpoCrudo = await req.text();
  const firma =
    req.headers.get("x-firma-estadia") ??
    req.headers.get("x-event-checksum") ??
    req.headers.get("x-signature") ?? // MercadoPago
    "";

  const db = obtenerDb();
  let evento;
  try {
    evento = await obtenerPasarela().verificarFirma(cuerpoCrudo, firma, {
      "x-request-id": req.headers.get("x-request-id"),
    });
  } catch (e) {
    if (e instanceof FirmaInvalidaError) {
      return NextResponse.json({ error: "firma inválida" }, { status: 401 });
    }
    throw e;
  }

  const resultado = await procesarWebhookPago(db, evento);
  if (resultado.resultado === "procesado") {
    const [link] = await db
      .select({ reservaId: linksDePago.reservaId, mitad: linksDePago.mitad })
      .from(linksDePago)
      .where(eq(linksDePago.id, evento.linkId));
    if (link) {
      await transicionPostPago(db, link.reservaId, link.mitad);
      await notificarPagoConfirmado(db, link.reservaId, link.mitad);
      // Al confirmarse el Pago 1 se genera el contrato automáticamente,
      // con la plantilla según duración e identidades reales SOLO adentro.
      if (link.mitad === 1) await generarContrato(db, link.reservaId);
    }
  } else if (resultado.resultado === "duplicado") {
    // RECONCILIACIÓN: si el dinero se procesó pero el proceso murió antes de
    // la transición (respuesta 500 → reintento de la pasarela), la reserva
    // quedó atrás respecto a su link pagado. El reintento la rescata aquí:
    // sin esto sería un zombie con dinero cobrado para siempre.
    await reconciliarPostPago(db, evento.linkId);
  }
  // 200 también en duplicado/fechas_tomadas: la pasarela no debe reintentar.
  return NextResponse.json(resultado);
}

async function reconciliarPostPago(db: ReturnType<typeof obtenerDb>, linkId: string) {
  const [link] = await db
    .select({ reservaId: linksDePago.reservaId, mitad: linksDePago.mitad, estado: linksDePago.estado })
    .from(linksDePago)
    .where(eq(linksDePago.id, linkId));
  if (!link || link.estado !== "pagado") return;
  const { reservas } = await import("@/server/db/schema");
  const [res] = await db
    .select({ estado: reservas.estado })
    .from(reservas)
    .where(eq(reservas.id, link.reservaId));
  const atrasada =
    (link.mitad === 1 && res?.estado === "LINK_1_ENVIADO") ||
    (link.mitad === 2 && res?.estado === "SALDO_LINK_ENVIADO");
  if (!atrasada) return;
  await transicionPostPago(db, link.reservaId, link.mitad);
  await notificarPagoConfirmado(db, link.reservaId, link.mitad);
  if (link.mitad === 1) await generarContrato(db, link.reservaId);
}
