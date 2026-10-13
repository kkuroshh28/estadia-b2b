import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { hayDb } from "@/server/datos/fuente";
import { cronAutorizado } from "@/server/config";

/**
 * Salud de la plataforma para monitoreo externo (UptimeRobot/BetterStack).
 * Público: solo {ok, db}. Drivers/versión SOLO con Bearer CRON_SECRET (no dar
 * pistas de reconocimiento).
 */
export async function GET(req: Request) {
  const detalle = cronAutorizado(req);
  const drivers = {
    pasarela: process.env.PASARELA_DRIVER ?? "simulado",
    kyc: process.env.KYC_DRIVER ?? "simulado",
    email: process.env.EMAIL_DRIVER ?? "simulado",
    authExigida: process.env.MODO_AUTH === "exigida",
  };
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

  if (!hayDb()) {
    return NextResponse.json({ ok: true, db: "sin_configurar", ...(detalle && { drivers, version }) });
  }
  try {
    const inicio = Date.now();
    await obtenerDb().execute(sql`SELECT 1`);
    return NextResponse.json({
      ok: true,
      db: "ok",
      dbLatenciaMs: Date.now() - inicio,
      ...(detalle && { drivers, version }),
    });
  } catch {
    return NextResponse.json(
      { ok: false, db: "error", ...(detalle && { drivers, version }) },
      { status: 503 },
    );
  }
}
