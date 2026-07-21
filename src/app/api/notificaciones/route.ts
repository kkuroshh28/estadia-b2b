import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { notificaciones } from "@/server/db/schema";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { limitar } from "@/server/rate-limit";

/** Campanita: últimas notificaciones del usuario + marcar leídas. */

const Rol = z.enum(["propietario", "principal", "externo"]);

export async function GET(req: Request) {
  const excedido = limitar(req, "notificaciones", 60);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ noLeidas: 0, items: [] });

  const como = Rol.safeParse(new URL(req.url).searchParams.get("como"));
  if (!como.success) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, como.data);
  if (!actor) return NextResponse.json({ noLeidas: 0, items: [] });

  const items = await db
    .select()
    .from(notificaciones)
    .where(eq(notificaciones.usuarioId, actor.id))
    .orderBy(desc(notificaciones.creadaEn))
    .limit(15);
  const [{ noLeidas }] = await db
    .select({ noLeidas: sql<number>`count(*)::int` })
    .from(notificaciones)
    .where(and(eq(notificaciones.usuarioId, actor.id), eq(notificaciones.leida, false)));

  return NextResponse.json({
    noLeidas,
    items: items.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      cuerpo: n.cuerpo,
      url: n.url,
      leida: n.leida,
    })),
  });
}

export async function POST(req: Request) {
  const excedido = limitar(req, "notificaciones-leer", 30);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ ok: true });

  const cuerpo = z
    .object({ como: Rol })
    .safeParse(await req.json().catch(() => null));
  if (!cuerpo.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, cuerpo.data.como);
  if (!actor) return NextResponse.json({ ok: true });

  await db
    .update(notificaciones)
    .set({ leida: true })
    .where(and(eq(notificaciones.usuarioId, actor.id), eq(notificaciones.leida, false)));
  return NextResponse.json({ ok: true });
}
