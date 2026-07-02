import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { sincronizacionesIcal } from "@/server/db/schema";
import { importarIcs } from "@/server/servicios/ical";

/**
 * Job de sincronización iCal (cada 15-30 min vía Vercel Cron / Inngest).
 * Protegido con CRON_SECRET para que nadie lo dispare por curl.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const db = obtenerDb();
  const fuentes = await db
    .select()
    .from(sincronizacionesIcal)
    .where(eq(sincronizacionesIcal.direccion, "import"));

  const resultados = [];
  for (const f of fuentes) {
    try {
      const res = await fetch(f.url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = await importarIcs(db, f.propiedadId, await res.text(), f.url);
      resultados.push({ propiedadId: f.propiedadId, ...r });
    } catch (e) {
      resultados.push({ propiedadId: f.propiedadId, error: String(e) });
    }
  }
  return NextResponse.json({ fuentes: fuentes.length, resultados });
}
