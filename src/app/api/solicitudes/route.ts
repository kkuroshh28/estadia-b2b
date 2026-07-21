import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { crearSolicitud, OperacionError } from "@/server/servicios/solicitudes";
import { limitar } from "@/server/rate-limit";

/** El Externo pide fechas. Las reglas (1–92 noches, capacidad, regla #3) viven en el servicio. */
const Cuerpo = z.object({
  propiedadId: z.uuid(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  huespedes: z.number().int().min(1).max(50),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "solicitudes", 20);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Demo sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, "externo");
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const r = await crearSolicitud(db, { externoId: actor.id, ...parseado.data });
    return NextResponse.json({ ok: true, solicitudId: r.solicitudId });
  } catch (e) {
    if (e instanceof OperacionError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
