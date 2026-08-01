import { NextResponse } from "next/server";
import { obtenerDb } from "@/server/db";
import { expirarVigencias } from "@/server/servicios/vigencias";
import { cronAutorizado } from "@/server/config";

/** Cron de vigencias (cada 10 min). Protegido con CRON_SECRET. */
export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const resultado = await expirarVigencias(obtenerDb());
  return NextResponse.json(resultado);
}
