/**
 * Reglas de negocio validadas EN SERVIDOR (el date-picker es solo UX).
 */

/** Regla #2: rentas cortas únicamente — de 1 noche a máximo 3 meses (92 noches). */
export const MIN_NOCHES = 1;
export const MAX_NOCHES = 92;

export function validarDuracion(desde: string, hasta: string): {
  valida: boolean;
  noches: number;
  motivo?: string;
} {
  const noches = nochesEntre(desde, hasta);
  if (!Number.isFinite(noches) || noches < MIN_NOCHES) {
    return { valida: false, noches, motivo: "La The Circle mínima es 1 noche." };
  }
  if (noches > MAX_NOCHES) {
    return {
      valida: false,
      noches,
      motivo: "Rentas cortas únicamente: máximo 3 meses (92 noches).",
    };
  }
  return { valida: true, noches };
}

/** Noches entre dos fechas ISO (YYYY-MM-DD), sin depender de la TZ del proceso. */
export function nochesEntre(desde: string, hasta: string): number {
  const a = Date.UTC(...descomponer(desde));
  const b = Date.UTC(...descomponer(hasta));
  return Math.round((b - a) / 86_400_000);
}

function descomponer(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, (m ?? 1) - 1, d ?? 1];
}

/** Regla #4: entre 3 y 5 comisionistas principales por propiedad. */
export const MIN_PRINCIPALES = 3;
export const MAX_PRINCIPALES = 5;

export function puedeVincularPrincipal(activos: number): boolean {
  return activos < MAX_PRINCIPALES;
}

export function puedeDesvincularPrincipal(activos: number): boolean {
  return activos > MIN_PRINCIPALES;
}
