import type { Propiedad } from "./tipos";

const TIPO: Record<Propiedad["tipo"], string> = {
  finca: "Finca",
  apartamento: "Apartamento",
  casa: "Casa",
  glamping: "Glamping",
};

/** Ubicación visible: la pública de la ficha, o municipio · zona. */
export function ubicacionDe(p: Propiedad): string {
  return p.ubicacionPublica?.trim() || [p.municipio, p.zona].filter(Boolean).join(" · ");
}

/**
 * Línea resumen de la ficha. Habitaciones/baños en 0 = dato sin confirmar:
 * se omiten en vez de mostrar un número falso.
 */
export function lineaDeFicha(p: Propiedad): string {
  const partes = [ubicacionDe(p), TIPO[p.tipo] ?? p.tipo, `${p.capacidad} personas`];
  if (p.habitaciones > 0) partes.push(`${p.habitaciones} hab`);
  if (p.banos > 0) partes.push(`${p.banos} baños`);
  return partes.join(" · ");
}
