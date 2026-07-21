import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { aceptarYAbrirNegociacion, OperacionError } from "@/server/servicios/solicitudes";
import { limitar } from "@/server/rate-limit";

/** "El primero que acepta gana" — la atomicidad vive en el servicio (UPDATE condicional). */
const Cuerpo = z.object({ solicitudId: z.uuid() });

export async function POST(req: Request) {
  const excedido = limitar(req, "solicitudes-aceptar", 30);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Demo sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, "principal");
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const r = await aceptarYAbrirNegociacion(db, parseado.data.solicitudId, actor.id);
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof OperacionError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
