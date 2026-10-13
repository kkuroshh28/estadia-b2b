import { NextResponse, after } from "next/server";
import { obtenerDb } from "@/server/db";
import { obtenerPasarela, FirmaInvalidaError } from "@/server/adaptadores/pasarela";
import { procesarWebhookPago, transicionPostPago } from "@/server/servicios/pagos";
import { notificarPagoConfirmado } from "@/server/servicios/notificaciones";
import { generarContrato } from "@/server/servicios/contratos";
import { and, eq } from "drizzle-orm";
import { contratos, linksDePago, reservas } from "@/server/db/schema";

/**
 * ÚNICA entrada de confirmación de pago — real o simulada, el MISMO camino:
 * verificación de firma → idempotencia → transacción del dinero (que ya
 * incluye la transición de estado) → contrato. Emails y campanita van DESPUÉS
 * de la respuesta (after): un proveedor de correo lento jamás demora el 200
 * ni provoca reintentos de la pasarela. Nada de polling.
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
      // La transición ya ocurrió DENTRO de la transacción del dinero.
      // Al confirmarse el Pago 1 se genera el contrato automáticamente,
      // con la plantilla según duración e identidades reales SOLO adentro.
      if (link.mitad === 1) await generarContrato(db, link.reservaId);
      await programarAvisos(db, link.reservaId, link.mitad);
    }
  } else if (resultado.resultado === "duplicado") {
    // RECONCILIACIÓN: si el dinero se procesó pero el proceso murió antes del
    // contrato (respuesta 500 → reintento de la pasarela), el reintento lo
    // rescata aquí. También cubre reservas antiguas atrasadas de estado.
    await reconciliarPostPago(db, evento.linkId);
  }
  // 200 también en duplicado/fechas_tomadas/monto_no_coincide: la pasarela
  // no debe reintentar (la compensación ya quedó registrada).
  return NextResponse.json(resultado);
}

/** Emails + campanita tras la respuesta; cada aviso falla por su cuenta. */
async function programarAvisos(db: ReturnType<typeof obtenerDb>, reservaId: string, mitad: number) {
  const avisar = async () => {
    const r = await Promise.allSettled([notificarPagoConfirmado(db, reservaId, mitad)]);
    for (const x of r) {
      if (x.status === "rejected") console.error("[webhook] aviso de pago falló:", x.reason);
    }
  };
  try {
    after(avisar);
  } catch {
    // Fuera de un request de Next (tests / scripts): se avisa en línea.
    await avisar();
  }
}

async function reconciliarPostPago(db: ReturnType<typeof obtenerDb>, linkId: string) {
  const [link] = await db
    .select({ reservaId: linksDePago.reservaId, mitad: linksDePago.mitad, estado: linksDePago.estado })
    .from(linksDePago)
    .where(eq(linksDePago.id, linkId));
  if (!link || link.estado !== "pagado") return;
  const [res] = await db
    .select({ estado: reservas.estado })
    .from(reservas)
    .where(eq(reservas.id, link.reservaId));
  const atrasada =
    (link.mitad === 1 && res?.estado === "LINK_1_ENVIADO") ||
    (link.mitad === 2 && res?.estado === "SALDO_LINK_ENVIADO");
  if (atrasada) await transicionPostPago(db, link.reservaId, link.mitad);

  // Pago 1 cobrado ⇒ el contrato DEBE existir (generarContrato es idempotente).
  const [pago1] = await db
    .select({ id: linksDePago.id })
    .from(linksDePago)
    .where(
      and(
        eq(linksDePago.reservaId, link.reservaId),
        eq(linksDePago.mitad, 1),
        eq(linksDePago.estado, "pagado"),
      ),
    );
  const [contrato] = await db
    .select({ id: contratos.id })
    .from(contratos)
    .where(eq(contratos.reservaId, link.reservaId));
  if (pago1 && !contrato) await generarContrato(db, link.reservaId);

  if (atrasada) await programarAvisos(db, link.reservaId, link.mitad);
}
