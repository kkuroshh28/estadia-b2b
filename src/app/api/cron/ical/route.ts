import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { obtenerDb } from "@/server/db";
import { sincronizacionesIcal } from "@/server/db/schema";
import { descargarIcs, sincronizarIcalPropiedad } from "@/server/servicios/ical";
import { cronAutorizado } from "@/server/config";

/** Descargas lentas de terceros: hasta 5 minutos por corrida. */
export const maxDuration = 300;

/** Propiedades por corrida (lote rotativo: las menos recientes primero). */
const LOTE_PROPIEDADES = 50;
/** Descargas simultáneas. */
const CONCURRENCIA = 5;
/** Clave del candado de Postgres contra corridas solapadas. */
const CANDADO_ICAL = 7_150_015;

/**
 * Job de sincronización iCal (cada 15-30 min vía Vercel Cron / Inngest).
 * Protegido con CRON_SECRET para que nadie lo dispare por curl.
 * - Candado pg_try_advisory_xact_lock: si otra corrida sigue viva, esta sale.
 * - Lote rotativo de propiedades ORDER BY ultima_sync NULLS FIRST LIMIT 50.
 * - Descargas en lotes de 5 con Promise.allSettled (una caída no frena nada).
 * - Por propiedad: si TODAS sus fuentes bajaron, el conjunto bloqueado_ical
 *   se REEMPLAZA (se libera lo que ya no viene); si alguna falló, solo agrega.
 */
export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const db = obtenerDb();

  // La transacción SOLO sostiene el candado (se suelta al terminar); las
  // escrituras van por conexiones propias para no retener locks de días.
  const salida = await db.transaction(async (tx) => {
    const [candado] = (await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(${CANDADO_ICAL}) AS ok`,
    )) as unknown as { ok: boolean }[];
    if (!candado?.ok) return { omitido: "otra sincronización en curso" as const };

    const lote = (await db.execute(sql`
      SELECT propiedad_id FROM sincronizaciones_ical
      WHERE direccion = 'import'
      GROUP BY propiedad_id
      ORDER BY bool_or(ultima_sync IS NULL) DESC, min(ultima_sync) ASC NULLS FIRST
      LIMIT ${LOTE_PROPIEDADES}`)) as unknown as { propiedad_id: string }[];
    if (lote.length === 0) return { propiedades: 0, fuentes: 0, resultados: [] };

    const fuentes = await db
      .select()
      .from(sincronizacionesIcal)
      .where(
        and(
          eq(sincronizacionesIcal.direccion, "import"),
          inArray(
            sincronizacionesIcal.propiedadId,
            lote.map((l) => l.propiedad_id),
          ),
        ),
      );

    // Descargas con concurrencia limitada.
    const descargas = new Map<string, { ok: true; texto: string } | { ok: false; error: string }>();
    for (let i = 0; i < fuentes.length; i += CONCURRENCIA) {
      const tanda = fuentes.slice(i, i + CONCURRENCIA);
      const r = await Promise.allSettled(tanda.map((f) => descargarIcs(f.url)));
      r.forEach((res, j) => {
        descargas.set(
          tanda[j].id,
          res.status === "fulfilled"
            ? { ok: true, texto: res.value }
            : { ok: false, error: String(res.reason) },
        );
      });
    }

    const porPropiedad = new Map<string, typeof fuentes>();
    for (const f of fuentes) {
      porPropiedad.set(f.propiedadId, [...(porPropiedad.get(f.propiedadId) ?? []), f]);
    }

    const resultados: Record<string, unknown>[] = [];
    for (const [propiedadId, suyas] of porPropiedad) {
      const buenas = suyas.filter((f) => descargas.get(f.id)?.ok);
      const errores = suyas
        .map((f) => descargas.get(f.id))
        .filter((d): d is { ok: false; error: string } => !!d && !d.ok)
        .map((d) => d.error);
      if (buenas.length === 0) {
        resultados.push({ propiedadId, errores });
        continue;
      }
      try {
        const r = await sincronizarIcalPropiedad(
          db,
          propiedadId,
          buenas.map((f) => (descargas.get(f.id) as { texto: string }).texto),
          {
            reemplazar: buenas.length === suyas.length,
            fuente: buenas.map((f) => f.url).join(" | "),
            fuenteIds: buenas.map((f) => f.id),
          },
        );
        resultados.push({ propiedadId, ...r, ...(errores.length ? { errores } : {}) });
      } catch (e) {
        resultados.push({ propiedadId, errores: [...errores, String(e)] });
      }
    }
    return { propiedades: porPropiedad.size, fuentes: fuentes.length, resultados };
  });

  return NextResponse.json(salida);
}
