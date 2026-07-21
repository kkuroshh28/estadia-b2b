import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { aceptarOferta, OperacionError } from "@/server/servicios/solicitudes";
import { limitar } from "@/server/rate-limit";

/** Acepta la oferta activa de la contraparte: el link del Pago 1 sale del MOTOR (regla #6). */
const Cuerpo = z.object({
  ofertaId: z.uuid(),
  como: z.enum(["principal", "externo"]),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "negociacion-aceptar", 30);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Demo sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  // `como` decide el rol SOLO para resolver el usuario; la pertenencia real a
  // la negociación se valida en el servicio (participante/turno).
  const actor = await actorDePeticion(db, parseado.data.como);
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const r = await aceptarOferta(db, parseado.data.ofertaId, actor.id);
    return NextResponse.json({
      ok: true,
      linkId: r.linkId,
      montoPesos: Math.round(r.montoCentavos / 100),
    });
  } catch (e) {
    if (e instanceof OperacionError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
