import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { mensajesChat, solicitudes } from "@/server/db/schema";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { procesarMensaje } from "@/server/servicios/antifuga";
import { limitar } from "@/server/rate-limit";

/**
 * Envío REAL de mensajes del chat interno. TODO mensaje pasa por
 * procesarMensaje (anti-fuga server-side): un bloqueado se persiste como
 * evidencia (bloqueado=true, jamás se entrega) y suma strike; al 3º el
 * servicio banea la identidad y retira el alias.
 */
const Cuerpo = z.object({
  solicitudId: z.uuid(),
  texto: z.string().min(1).max(2000),
  como: z.enum(["principal", "externo"]),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "chat-mensajes", 60);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Demo sin base de datos" }, { status: 503 });

  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = obtenerDb();
  const actor = await actorDePeticion(db, parseado.data.como);
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Solo los participantes de la solicitud pueden escribir en su hilo.
  const [sol] = await db
    .select()
    .from(solicitudes)
    .where(
      and(
        eq(solicitudes.id, parseado.data.solicitudId),
        sql`(${solicitudes.principalAceptanteId} = ${actor.id} OR ${solicitudes.externoId} = ${actor.id})`,
      ),
    );
  if (!sol) return NextResponse.json({ error: "No eres parte de esta conversación" }, { status: 403 });

  const veredicto = await procesarMensaje(db, actor.id, parseado.data.texto);
  const bloqueado = veredicto.veredicto === "bloqueado";
  await db.insert(mensajesChat).values({
    solicitudId: sol.id,
    emisorId: actor.id,
    contenido: parseado.data.texto,
    bloqueado,
    flags: bloqueado ? veredicto.motivos : [],
  });

  return NextResponse.json(
    bloqueado
      ? { veredicto: "bloqueado", motivos: veredicto.motivos, strikes: veredicto.strikes, baneado: veredicto.baneado }
      : { veredicto: "permitido" },
  );
}
