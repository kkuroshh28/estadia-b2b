import { NextResponse } from "next/server";
import { obtenerDb } from "@/server/db";
import { exportarIcs, verificarTokenIcal } from "@/server/servicios/ical";

/** Export .ics por propiedad: URL con token HMAC (para pegar en Airbnb/Booking). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ propiedadId: string }> },
) {
  const { propiedadId } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!verificarTokenIcal(propiedadId, token)) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }
  const ics = await exportarIcs(obtenerDb(), propiedadId);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=estadia.ics",
    },
  });
}
