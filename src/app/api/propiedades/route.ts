import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { crearPropiedad, PropiedadError } from "@/server/servicios/propiedades";
import { limitar } from "@/server/rate-limit";

/** Alta real de propiedad (con tarifa y suscripción piloto automática). */
const Cuerpo = z.object({
  nombre: z.string().min(3).max(80),
  municipio: z.string().min(2).max(60),
  zona: z.string().min(2).max(60),
  tipo: z.enum(["finca", "apartamento", "casa", "glamping"]),
  capacidad: z.number().int().min(1).max(50),
  habitaciones: z.number().int().min(1).max(30),
  banos: z.number().int().min(1).max(30),
  amenidades: z.array(z.string().max(60)).max(12),
  reglas: z.array(z.string().max(80)).max(12),
  tarifaNetaNochePesos: z.number().int().min(50_000).max(50_000_000),
  publicada: z.boolean(),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "propiedades", 20);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, "propietario");
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const r = await crearPropiedad(db, actor.id, parseado.data);
    return NextResponse.json({ ok: true, propiedadId: r.propiedadId });
  } catch (e) {
    if (e instanceof PropiedadError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
