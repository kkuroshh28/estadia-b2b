import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { alertasAdmin, calendarioDias, propiedades, sincronizacionesIcal } from "../db/schema";
import { hmacFirma, igualdadSegura } from "../crypto";
import { secretoObligatorio } from "../config";
import { hoyEnBogota } from "@/lib/fechas";

/**
 * iCal bidireccional (regla #15).
 * Export: URL .ics por propiedad con token HMAC (no adivinable).
 * Import: parser de VEVENT (formatos de Airbnb/Booking) → bloqueado_ical.
 * Conflicto (el externo quiere bloquear un día YA reservado por la app) →
 * alerta a admin + NO se pisa la reserva: el dinero manda.
 */

/**
 * Anti-SSRF: solo se importan calendarios de dominios conocidos (Airbnb,
 * Booking, Google, VRBO…). Bloquea URLs internas/metadata cloud y esquemas
 * distintos de https.
 */
const DOMINIOS_ICAL = [
  "airbnb.com",
  "airbnb.es",
  "booking.com",
  "admin.booking.com",
  "ical.booking.com",
  "calendar.google.com",
  "vrbo.com",
  "homeaway.com",
  "expedia.com",
];
export function urlIcalSegura(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return DOMINIOS_ICAL.some((d) => host === d || host.endsWith(`.${d}`));
}

export function tokenIcal(propiedadId: string): string {
  const secreto = secretoObligatorio("ICAL_SECRET") ?? "dev-ical-secret";
  return hmacFirma(`ical:${propiedadId}`, secreto).slice(0, 32);
}

export function verificarTokenIcal(propiedadId: string, token: string): boolean {
  return igualdadSegura(tokenIcal(propiedadId), token);
}

/** Exporta los días NO disponibles como eventos (lo que Airbnb/Booking esperan). */
export async function exportarIcs(db: Db, propiedadId: string): Promise<string> {
  const [prop] = await db.select().from(propiedades).where(eq(propiedades.id, propiedadId));
  if (!prop) throw new Error("Propiedad no encontrada");
  const dias = await db
    .select()
    .from(calendarioDias)
    .where(
      and(
        eq(calendarioDias.propiedadId, propiedadId),
        sql`estado <> 'disponible'`,
        gte(
          calendarioDias.fecha,
          sql`(now() AT TIME ZONE 'America/Bogota')::date - interval '30 days'` as unknown as string,
        ),
      ),
    );

  const eventos = dias
    .map((d) => {
      const ymd = d.fecha.replaceAll("-", "");
      const siguiente = fechaMas1(d.fecha).replaceAll("-", "");
      return [
        "BEGIN:VEVENT",
        `UID:thecircle-${propiedadId}-${ymd}@thecircle.app`,
        `DTSTART;VALUE=DATE:${ymd}`,
        `DTEND;VALUE=DATE:${siguiente}`,
        `SUMMARY:${d.estado === "reservado_app" ? "Reservado (THE CIRCLE)" : "No disponible"}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//THE CIRCLE//Calendario//ES",
    `X-WR-CALNAME:${prop.nombre} (THE CIRCLE)`,
    eventos,
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Parser tolerante de VEVENT: DTSTART/DTEND en VALUE=DATE o datetime UTC. */
export function parsearIcs(ics: string): { desde: string; hasta: string }[] {
  const eventos: { desde: string; hasta: string }[] = [];
  // Desplegar líneas continuadas (RFC 5545: CRLF + espacio)
  const plano = ics.replace(/\r?\n[ \t]/g, "");
  for (const bloque of plano.split("BEGIN:VEVENT").slice(1)) {
    const desde = bloque.match(/DTSTART(?:;VALUE=DATE)?(?:;TZID=[^:]+)?:(\d{8})/)?.[1];
    const hasta = bloque.match(/DTEND(?:;VALUE=DATE)?(?:;TZID=[^:]+)?:(\d{8})/)?.[1];
    if (desde && hasta) {
      eventos.push({ desde: aIso(desde), hasta: aIso(hasta) });
    }
  }
  return eventos;
}

export interface ResultadoImport {
  diasBloqueados: number;
  conflictos: number;
  /** Días bloqueado_ical liberados porque ya no vienen en ninguna fuente. */
  diasLiberados: number;
}

/** Horizonte de importación: de hoy (Bogotá) a hoy + 18 meses. */
const MESES_HORIZONTE = 18;

/** Tope de tamaño de un .ics remoto (2 MB) — evita DoS de memoria. */
export const MAX_ICS_BYTES = 2 * 1024 * 1024;

/**
 * Importa un .ics de UNA fuente: bloquea días libres; conflicto con reserva
 * pagada → alerta. NO libera días (otra fuente de la misma propiedad puede
 * ser la dueña de ese bloqueo); el reemplazo completo lo hace el cron con
 * sincronizarIcalPropiedad cuando TODAS las fuentes de la propiedad bajaron.
 */
export async function importarIcs(
  db: Db,
  propiedadId: string,
  icsTexto: string,
  fuente = "externo",
): Promise<ResultadoImport> {
  return await sincronizarIcalPropiedad(db, propiedadId, [icsTexto], { reemplazar: false, fuente });
}

/**
 * Sincroniza el conjunto bloqueado_ical de una propiedad con sus calendarios.
 *
 * El esquema NO guarda qué fuente bloqueó cada día (calendario_dias no tiene
 * columna de fuente), así que "reemplazar el conjunto de la fuente" se hace a
 * nivel PROPIEDAD: con `reemplazar` (solo cuando TODAS sus fuentes de import
 * se descargaron bien), cada día futuro bloqueado_ical que ya no venga en
 * NINGUNA fuente vuelve a 'disponible'. Si alguna fuente falló, solo se
 * agrega (jamás se libera algo que quizá bloquea la fuente caída).
 *
 * Rango recortado a [hoy, hoy+18 meses) en hora Colombia; toda la escritura
 * es un único INSERT … SELECT unnest … ON CONFLICT (sin un SELECT por día).
 */
export async function sincronizarIcalPropiedad(
  db: Db,
  propiedadId: string,
  calendarios: string[],
  opciones: { reemplazar: boolean; fuente?: string; fuenteIds?: string[] },
): Promise<ResultadoImport> {
  const hoy = hoyEnBogota();
  const tope = sumarMeses(hoy, MESES_HORIZONTE);

  const fechas = new Set<string>();
  for (const texto of calendarios) {
    for (const ev of parsearIcs(texto)) {
      // DTEND en VALUE=DATE es EXCLUSIVO (estándar iCal)
      const desde = ev.desde < hoy ? hoy : ev.desde;
      const hasta = ev.hasta > tope ? tope : ev.hasta;
      for (let f = desde; f < hasta; f = fechaMas1(f)) fechas.add(f);
    }
  }
  // Orden ascendente: los locks de fila se toman en el mismo orden que el
  // webhook de pago (menos riesgo de deadlock).
  const lista = [...fechas].sort();
  const arreglo = sql`string_to_array(${lista.join(",")}, ',')::date[]`;

  return await db.transaction(async (tx) => {
    const bloqueados = (await tx.execute(sql`
      INSERT INTO calendario_dias (propiedad_id, fecha, estado)
      SELECT ${propiedadId}, f, 'bloqueado_ical'
      FROM unnest(${arreglo}) AS f
      ON CONFLICT (propiedad_id, fecha) DO UPDATE
        SET estado = 'bloqueado_ical', actualizado_en = now()
        WHERE calendario_dias.estado = 'disponible'
      RETURNING fecha`)) as unknown as { fecha: string }[];

    // JAMÁS pisar una reserva pagada: alerta a admin (un solo insert).
    const choques = (await tx.execute(sql`
      SELECT fecha::text AS fecha, reserva_id FROM calendario_dias
      WHERE propiedad_id = ${propiedadId}
        AND estado = 'reservado_app'
        AND fecha = ANY(${arreglo})`)) as unknown as { fecha: string; reserva_id: string | null }[];
    if (choques.length) {
      await tx.insert(alertasAdmin).values(
        choques.map((c) => ({
          tipo: "conflicto_ical",
          detalle: { propiedadId, fecha: c.fecha, fuente: opciones.fuente ?? "externo", reservaId: c.reserva_id },
        })),
      );
    }

    let diasLiberados = 0;
    if (opciones.reemplazar) {
      const liberados = (await tx.execute(sql`
        UPDATE calendario_dias SET estado = 'disponible', actualizado_en = now()
        WHERE propiedad_id = ${propiedadId}
          AND estado = 'bloqueado_ical'
          AND fecha >= ${hoy}::date
          AND NOT (fecha = ANY(${arreglo}))
        RETURNING fecha`)) as unknown as { fecha: string }[];
      diasLiberados = liberados.length;
    }

    // Última sync visible: solo de las fuentes que efectivamente bajaron.
    if (!opciones.fuenteIds || opciones.fuenteIds.length > 0) {
      await tx
        .update(sincronizacionesIcal)
        .set({ ultimaSync: sql`now()` })
        .where(
          opciones.fuenteIds
            ? and(
                eq(sincronizacionesIcal.propiedadId, propiedadId),
                inArray(sincronizacionesIcal.id, opciones.fuenteIds),
              )
            : eq(sincronizacionesIcal.propiedadId, propiedadId),
        );
    }

    return { diasBloqueados: bloqueados.length, conflictos: choques.length, diasLiberados };
  });
}

/**
 * Descarga un .ics remoto con defensa anti-SSRF COMPLETA: cada salto de
 * redirección se re-valida contra la lista de dominios (redirect manual, máx.
 * 3) y el cuerpo se lee como stream con tope de bytes — jamás se carga en
 * memoria un cuerpo gigante antes de medirlo.
 */
export async function descargarIcs(url: string, timeoutMs = 15_000): Promise<string> {
  let actual = url;
  for (let salto = 0; salto <= 3; salto++) {
    if (!urlIcalSegura(actual)) throw new Error("URL de calendario no permitida");
    const res = await fetch(actual, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 300 && res.status < 400) {
      const destino = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!destino) throw new Error(`Redirección sin destino (HTTP ${res.status})`);
      actual = new URL(destino, actual).toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`HTTP ${res.status}`);
    }
    const largo = Number(res.headers.get("content-length") ?? 0);
    if (largo > MAX_ICS_BYTES) {
      await res.body?.cancel().catch(() => {});
      throw new Error("Calendario demasiado grande");
    }
    return await leerConTope(res, MAX_ICS_BYTES);
  }
  throw new Error("Demasiadas redirecciones");
}

async function leerConTope(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const lector = res.body.getReader();
  const decodificador = new TextDecoder();
  let total = 0;
  let texto = "";
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel().catch(() => {});
      throw new Error("Calendario demasiado grande");
    }
    texto += decodificador.decode(value, { stream: true });
  }
  return texto + decodificador.decode();
}

function sumarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + meses, d, 12)).toISOString().slice(0, 10);
}

function aIso(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function fechaMas1(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d + 1));
  return fecha.toISOString().slice(0, 10);
}
