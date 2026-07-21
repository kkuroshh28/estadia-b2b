import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import {
  desvincularPrincipal,
  PropiedadError,
  vincularPrincipal,
} from "@/server/servicios/propiedades";
import { limitar } from "@/server/rate-limit";

/** Vincular/desvincular principales por ALIAS (regla #4 en el servicio). */
const Cuerpo = z.object({
  propiedadId: z.uuid(),
  alias: z.string().min(3).max(30),
  accion: z.enum(["vincular", "desvincular"]),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "vinculos", 30);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, "propietario");
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { propiedadId, alias, accion } = parseado.data;
  try {
    if (accion === "vincular") {
      const r = await vincularPrincipal(db, actor.id, propiedadId, alias);
      return NextResponse.json({ ok: true, alias: r.alias });
    }
    await desvincularPrincipal(db, actor.id, propiedadId, alias);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof PropiedadError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
