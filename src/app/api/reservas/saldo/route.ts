import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { generarLinkSaldo, SaldoError } from "@/server/servicios/pagos";
import { limitar } from "@/server/rate-limit";

/** Genera el link del saldo (mitad 2) — idempotente; el monto sale del motor. */
const Cuerpo = z.object({
  reservaId: z.uuid(),
  como: z.enum(["principal", "externo"]),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "reservas-saldo", 30);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Demo sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, parseado.data.como);
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const r = await generarLinkSaldo(db, parseado.data.reservaId, actor.id);
    return NextResponse.json({
      ok: true,
      linkId: r.linkId,
      montoPesos: Math.round(r.montoCentavos / 100),
      yaExistia: r.yaExistia,
    });
  } catch (e) {
    if (e instanceof SaldoError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
