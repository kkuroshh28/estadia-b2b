import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { sincronizacionesIcal } from "@/server/db/schema";
import { importarIcs, urlIcalSegura } from "@/server/servicios/ical";
import { cronAutorizado } from "@/server/config";

/** Tope de tamaño de un .ics remoto (2 MB) — evita DoS de memoria. */
const MAX_ICS_BYTES = 2 * 1024 * 1024;

/**
 * Job de sincronización iCal (cada 15-30 min vía Vercel Cron / Inngest).
 * Protegido con CRON_SECRET para que nadie lo dispare por curl.
 */
export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
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
      // Anti-SSRF: solo dominios de calendario conocidos.
      if (!urlIcalSegura(f.url)) throw new Error("URL de calendario no permitida");
      const res = await fetch(f.url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const largo = Number(res.headers.get("content-length") ?? 0);
      if (largo > MAX_ICS_BYTES) throw new Error("Calendario demasiado grande");
      const texto = await res.text();
      if (texto.length > MAX_ICS_BYTES) throw new Error("Calendario demasiado grande");
      const r = await importarIcs(db, f.propiedadId, texto, f.url);
      resultados.push({ propiedadId: f.propiedadId, ...r });
    } catch (e) {
      resultados.push({ propiedadId: f.propiedadId, error: String(e) });
    }
  }
  return NextResponse.json({ fuentes: fuentes.length, resultados });
}
