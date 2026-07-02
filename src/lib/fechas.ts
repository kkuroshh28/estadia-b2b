/**
 * Fechas en zona America/Bogota — evita el bug clásico de off-by-one:
 * `new Date("2026-07-17")` se interpreta como medianoche UTC, que en Bogotá
 * (UTC−5) todavía es 16 de julio. Aquí toda fecha-calendario (YYYY-MM-DD)
 * se formatea SIN pasar por la zona del proceso.
 */

export const ZONA = "America/Bogota";

/** Formatea una fecha-calendario ISO (YYYY-MM-DD) en es-CO, sin corrimiento. */
export function formatearFechaCO(
  iso: string,
  opciones: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Mediodía UTC: está dentro del MISMO día calendario en Bogotá (UTC−5),
  // por lo que el formateo con timeZone Bogota nunca corre el día.
  const fecha = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("es-CO", { ...opciones, timeZone: ZONA }).format(fecha);
}

/** Día calendario ACTUAL en Bogotá como YYYY-MM-DD (para vigencias y cierres). */
export function hoyEnBogota(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}
