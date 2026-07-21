import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { contratos, contratosBlob } from "@/server/db/schema";
import { actorDePeticion, hayDb } from "@/server/datos/fuente";
import { puedeVerContrato } from "@/server/servicios/contratos";
import { limitar } from "@/server/rate-limit";

/**
 * Descarga del contrato PDF. SOLO propietario de la reserva (o admin):
 * los comisionistas jamás lo ven — ahí viven las identidades reales.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ reservaId: string }> },
) {
  const excedido = limitar(req, "contratos", 30);
  if (excedido) return excedido;
  if (!hayDb()) return NextResponse.json({ error: "Sin base de datos" }, { status: 503 });

  const { reservaId } = await params;
  const db = obtenerDb();
  const actor = await actorDePeticion(db, "propietario");
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await puedeVerContrato(db, actor.id, reservaId))) {
    return NextResponse.json({ error: "Sin acceso a este contrato" }, { status: 403 });
  }

  const [c] = await db.select().from(contratos).where(eq(contratos.reservaId, reservaId));
  if (!c) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  const [blob] = await db
    .select()
    .from(contratosBlob)
    .where(eq(contratosBlob.contratoId, c.id));
  if (!blob) return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });

  return new NextResponse(Buffer.from(blob.bytesBase64, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=contrato-${reservaId.slice(0, 8)}.pdf`,
      "X-Contrato-Sha256": c.hashSha256,
    },
  });
}
