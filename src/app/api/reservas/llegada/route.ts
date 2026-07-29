import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { datosLlegada, LlegadaError } from "@/server/servicios/reservas";
import { limitar } from "@/server/rate-limit";

/**
 * Anexo II — Revelación controlada: la dirección real SOLO se entrega a los
 * PARTICIPANTES de una reserva en semáforo verde. El chat la sigue
 * bloqueando: este es el único canal legítimo.
 */
const Cuerpo = z.object({
  reservaId: z.uuid(),
  como: z.enum(["propietario", "principal", "externo"]),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "reservas-llegada", 30);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, parseado.data.como);
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const r = await datosLlegada(db, actor.id, parseado.data.reservaId);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof LlegadaError) {
      const status = e.codigo === "no_participante" ? 403 : e.codigo === "sin_verde" ? 409 : 404;
      return NextResponse.json({ error: e.message }, { status });
    }
    throw e;
  }
}
