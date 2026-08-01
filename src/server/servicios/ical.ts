import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "../db";
import { alertasAdmin, calendarioDias, propiedades, sincronizacionesIcal } from "../db/schema";
import { hmacFirma, igualdadSegura } from "../crypto";
import { secretoObligatorio } from "../config";

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
        gte(calendarioDias.fecha, sql`current_date - interval '30 days'` as unknown as string),
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
}

/** Importa un .ics: bloquea días libres; conflicto con reserva pagada → alerta. */
export async function importarIcs(
  db: Db,
  propiedadId: string,
  icsTexto: string,
  fuente = "externo",
): Promise<ResultadoImport> {
  const eventos = parsearIcs(icsTexto);
  let diasBloqueados = 0;
  let conflictos = 0;

  await db.transaction(async (tx) => {
    for (const ev of eventos) {
      // DTEND en VALUE=DATE es EXCLUSIVO (estándar iCal)
      for (let f = ev.desde; f < ev.hasta; f = fechaMas1(f)) {
        const [dia] = await tx
          .select()
          .from(calendarioDias)
          .where(and(eq(calendarioDias.propiedadId, propiedadId), eq(calendarioDias.fecha, f)))
          .for("update");

        if (!dia) {
          await tx.insert(calendarioDias).values({ propiedadId, fecha: f, estado: "bloqueado_ical" });
          diasBloqueados++;
        } else if (dia.estado === "disponible") {
          await tx
            .update(calendarioDias)
            .set({ estado: "bloqueado_ical", actualizadoEn: sql`now()` })
            .where(and(eq(calendarioDias.propiedadId, propiedadId), eq(calendarioDias.fecha, f)));
          diasBloqueados++;
        } else if (dia.estado === "reservado_app") {
          // JAMÁS pisar una reserva pagada: alerta a admin + propietario.
          conflictos++;
          await tx.insert(alertasAdmin).values({
            tipo: "conflicto_ical",
            detalle: { propiedadId, fecha: f, fuente, reservaId: dia.reservaId },
          });
        }
        // bloqueado_manual / bloqueado_ical existentes: no-op
      }
    }
    await tx
      .update(sincronizacionesIcal)
      .set({ ultimaSync: sql`now()` })
      .where(eq(sincronizacionesIcal.propiedadId, propiedadId));
  });

  return { diasBloqueados, conflictos };
}

function aIso(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function fechaMas1(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d + 1));
  return fecha.toISOString().slice(0, 10);
}
