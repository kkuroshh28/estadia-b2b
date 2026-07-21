import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { propiedades, sincronizacionesIcal } from "@/server/db/schema";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { limitar } from "@/server/rate-limit";

/** Conectar/desconectar calendarios externos (Airbnb/Booking) por propiedad. */
const Cuerpo = z.object({
  propiedadId: z.uuid(),
  accion: z.enum(["agregar", "quitar"]),
  url: z.string().url().max(500).optional(),
  importId: z.uuid().optional(),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "ical-config", 20);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, "propietario");
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { propiedadId, accion, url, importId } = parseado.data;
  const [propia] = await db
    .select({ id: propiedades.id })
    .from(propiedades)
    .where(and(eq(propiedades.id, propiedadId), eq(propiedades.propietarioId, actor.id)));
  if (!propia) return NextResponse.json({ error: "La propiedad no es tuya" }, { status: 403 });

  if (accion === "agregar") {
    if (!url || !/^https:\/\//.test(url)) {
      return NextResponse.json({ error: "URL https requerida" }, { status: 422 });
    }
    const [fila] = await db
      .insert(sincronizacionesIcal)
      .values({ propiedadId, url, direccion: "import" })
      .returning({ id: sincronizacionesIcal.id });
    return NextResponse.json({ ok: true, importId: fila.id });
  }

  if (!importId) return NextResponse.json({ error: "importId requerido" }, { status: 422 });
  await db
    .delete(sincronizacionesIcal)
    .where(and(eq(sincronizacionesIcal.id, importId), eq(sincronizacionesIcal.propiedadId, propiedadId)));
  return NextResponse.json({ ok: true });
}
