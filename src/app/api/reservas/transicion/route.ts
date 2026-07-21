import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { propiedades, reservas } from "@/server/db/schema";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { transicionarReserva, TransicionInvalidaError } from "@/server/servicios/reservas";
import { limitar } from "@/server/rate-limit";

/**
 * Cierre del ciclo por el PROPIETARIO (quien entrega y recibe la casa):
 * PAGO_COMPLETO → CHECK_IN → COMPLETADA. La máquina de estados valida la
 * transición; cualquier otra ruta es imposible.
 */
const Cuerpo = z.object({
  reservaId: z.uuid(),
  hacia: z.enum(["CHECK_IN", "COMPLETADA"]),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "reservas-transicion", 30);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, "propietario");
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [propia] = await db
    .select({ id: reservas.id })
    .from(reservas)
    .innerJoin(propiedades, eq(reservas.propiedadId, propiedades.id))
    .where(and(eq(reservas.id, parseado.data.reservaId), eq(propiedades.propietarioId, actor.id)));
  if (!propia) return NextResponse.json({ error: "La reserva no es de tus propiedades" }, { status: 403 });

  try {
    await transicionarReserva(db, parseado.data.reservaId, parseado.data.hacia, actor.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TransicionInvalidaError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
