import { NextResponse } from "next/server";
import { obtenerDb } from "@/server/db";
import { expirarVigencias } from "@/server/servicios/vigencias";

/** Cron de vigencias (cada 10 min). Protegido con CRON_SECRET. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const resultado = await expirarVigencias(obtenerDb());
  return NextResponse.json(resultado);
}
