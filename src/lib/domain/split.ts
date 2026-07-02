/**
 * Modelo de dinero — reglas cerradas del producto:
 *  - Comisión = precio final acordado − tarifa neta del propietario.
 *  - Split de la comisión: 50% Principal / 40% Externo / 10% App.
 *  - El ~3% de pasarela lo asume SOLO el propietario (informado desde antes).
 *  - Pago en dos mitades (50/50); cada mitad se reparte al entrar, sin retenciones.
 *  - Piso de comisión: lógica programada desde el MVP, APAGADA al lanzamiento.
 */

export const PCT_PRINCIPAL = 0.5;
export const PCT_EXTERNO = 0.4;
export const PCT_APP = 0.1;
export const PCT_PASARELA = 0.03;

export interface ConfiguracionPlataforma {
  pisoComisionActivo: boolean;
  pisoComisionPct: number; // precio acordado >= tarifaNeta * (1 + pct)
}

/** Configuración de lanzamiento: sin piso (regla #8). */
export const CONFIG_LANZAMIENTO: ConfiguracionPlataforma = {
  pisoComisionActivo: false,
  pisoComisionPct: 0.08,
};

export interface Desglose {
  precioFinal: number;
  tarifaNeta: number;
  comision: number;
  principal: number;
  externo: number;
  app: number;
  pasarela: number;
  propietarioNeto: number;
}

export interface SplitReserva {
  total: Desglose;
  porMitad: Desglose;
}

function desglosar(precioFinal: number, tarifaNeta: number): Desglose {
  const comision = Math.max(0, precioFinal - tarifaNeta);
  const pasarela = Math.round(precioFinal * PCT_PASARELA);
  return {
    precioFinal,
    tarifaNeta,
    comision,
    principal: Math.round(comision * PCT_PRINCIPAL),
    externo: Math.round(comision * PCT_EXTERNO),
    app: Math.round(comision * PCT_APP),
    pasarela,
    propietarioNeto: tarifaNeta - pasarela,
  };
}

/** Calcula el split completo de una reserva (total + cada mitad 50/50). */
export function calcularSplit(precioFinal: number, tarifaNeta: number): SplitReserva {
  const mitadPrecio = Math.round(precioFinal / 2);
  const mitadNeta = Math.round(tarifaNeta / 2);
  return {
    total: desglosar(precioFinal, tarifaNeta),
    porMitad: desglosar(mitadPrecio, mitadNeta),
  };
}

/**
 * Valida una propuesta de precio contra las reglas vigentes.
 * El piso de comisión existe desde el MVP pero se activa por switch de configuración.
 */
export function validarPropuesta(
  precioPropuesto: number,
  tarifaNeta: number,
  config: ConfiguracionPlataforma = CONFIG_LANZAMIENTO,
): { valida: boolean; motivo?: string } {
  if (precioPropuesto < tarifaNeta) {
    return { valida: false, motivo: "El precio no puede ser inferior a la tarifa neta del propietario." };
  }
  if (config.pisoComisionActivo) {
    const minimo = tarifaNeta * (1 + config.pisoComisionPct);
    if (precioPropuesto < minimo) {
      return {
        valida: false,
        motivo: `Piso de comisión activo: el precio debe ser ≥ tarifa neta + ${Math.round(config.pisoComisionPct * 100)}%.`,
      };
    }
  }
  return { valida: true };
}

/** Calculadora de neto para el propietario (requisito de producto §4.5). */
export function calcularNetoPropietario(tarifaNeta: number): {
  tarifaNeta: number;
  costoPasarelaEstimado: number;
  recibe: number;
} {
  // La pasarela cobra sobre el total procesado; como mínimo el total = tarifa neta
  // (comisión 0). El costo real puede ser levemente mayor si hay comisión encima.
  const costoPasarelaEstimado = Math.round(tarifaNeta * PCT_PASARELA);
  return { tarifaNeta, costoPasarelaEstimado, recibe: tarifaNeta - costoPasarelaEstimado };
}

export function formatearCOP(monto: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(monto);
}
