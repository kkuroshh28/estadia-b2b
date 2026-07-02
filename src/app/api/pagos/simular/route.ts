import { NextResponse } from "next/server";
import { z } from "zod";
import { firmarEventoSimulado } from "@/server/adaptadores/pasarela";
import { tokenAleatorio } from "@/server/crypto";
import { POST as webhookPost } from "../../webhooks/pasarela/route";

/**
 * "Pago de prueba" del driver simulado: construye el evento y lo entrega al
 * MISMO webhook (misma firma, misma idempotencia) que usaría la pasarela real.
 * Solo existe con PASARELA_DRIVER=simulado.
 */
const Cuerpo = z.object({ linkId: z.string().uuid(), montoCentavos: z.number().int() });

export async function POST(req: Request) {
  if ((process.env.PASARELA_DRIVER ?? "simulado") !== "simulado") {
    return NextResponse.json({ error: "Solo disponible con pasarela simulada" }, { status: 404 });
  }
  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const evento = JSON.stringify({
    pasarelaRef: `sim-evt-${tokenAleatorio(10)}`,
    linkId: parseado.data.linkId,
    montoCentavos: parseado.data.montoCentavos,
    estado: "aprobada",
  });

  const peticion = new Request("http://interno/api/webhooks/pasarela", {
    method: "POST",
    headers: { "x-firma-estadia": firmarEventoSimulado(evento) },
    body: evento,
  });
  return webhookPost(peticion);
}
