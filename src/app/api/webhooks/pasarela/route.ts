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
    req.headers.get("x-firma-estadia") ?? req.headers.get("x-event-checksum") ?? "";

  const db = obtenerDb();
  let evento;
  try {
    evento = obtenerPasarela().verificarFirma(cuerpoCrudo, firma);
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
  }
  // 200 también en duplicado/fechas_tomadas: la pasarela no debe reintentar.
  return NextResponse.json(resultado);
}
