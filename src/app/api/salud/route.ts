import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { hayDb } from "@/server/datos/fuente";

/**
 * Salud de la plataforma para monitoreo externo (UptimeRobot/BetterStack).
 * Sin secretos: solo estado de la DB, drivers activos y versión del deploy.
 */
export async function GET() {
  const drivers = {
    pasarela: process.env.PASARELA_DRIVER ?? "simulado",
    kyc: process.env.KYC_DRIVER ?? "simulado",
    email: process.env.EMAIL_DRIVER ?? "simulado",
    authExigida: process.env.MODO_AUTH === "exigida",
  };
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

  if (!hayDb()) {
    return NextResponse.json({ ok: true, db: "sin_configurar", drivers, version });
  }
  try {
    const inicio = Date.now();
    await obtenerDb().execute(sql`SELECT 1`);
    return NextResponse.json({
      ok: true,
      db: "ok",
      dbLatenciaMs: Date.now() - inicio,
      drivers,
      version,
    });
  } catch {
    return NextResponse.json(
      { ok: false, db: "error", drivers, version },
      { status: 503 },
    );
  }
}
