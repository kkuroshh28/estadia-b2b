/**
 * Modelo de dinero — reglas cerradas del producto:
 *  - Comisión = precio final acordado − tarifa neta del propietario.
 *  - Split de la comisión: 45% Socio Comercial / 45% Socio de Ventas / 10% App.
 *  - El ~3% de pasarela lo asume SOLO el propietario (informado desde antes).
 *  - Pago en dos mitades (50/50); cada mitad se reparte al entrar, sin retenciones.
 *  - Piso de comisión: lógica programada desde el MVP, APAGADA al lanzamiento.
 */

import {
  BPS_PASARELA,
  centavos,
  liquidarReserva,
  porcentajeBps,
  type Centavos,
  type LiquidacionMitad,
} from "@/lib/dinero";

export const PCT_PRINCIPAL = 0.45;
export const PCT_EXTERNO = 0.45;
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

/** Pesos (UI) → centavos del motor; los montos de la UI son pesos enteros. */
function aCentavos(pesos: number): Centavos {
  return centavos(Math.round(pesos * 100));
}

/**
 * Desglose de UNA mitad con el MISMO motor que liquida en el servidor
 * (src/lib/dinero): floor + residuo a la app, mitad 1 en pesos enteros.
 * Los valores salen en pesos (pueden traer centavos: la UI formatea).
 */
function desglosarMitad(m: LiquidacionMitad): Desglose {
  return {
    precioFinal: m.montoCliente / 100,
    tarifaNeta: m.tarifaNeta / 100,
    comision: m.split.comision / 100,
    principal: m.split.principal / 100,
    externo: m.split.externo / 100,
    app: m.split.app / 100,
    pasarela: m.pasarela / 100,
    propietarioNeto: m.propietarioNeto / 100,
  };
}

/** Total = mitad 1 + mitad 2 campo a campo, sumado en centavos (exacto). */
function sumarDesgloses(a: Desglose, b: Desglose): Desglose {
  const c = (x: number, y: number) => (Math.round(x * 100) + Math.round(y * 100)) / 100;
  return {
    precioFinal: c(a.precioFinal, b.precioFinal),
    tarifaNeta: c(a.tarifaNeta, b.tarifaNeta),
    comision: c(a.comision, b.comision),
    principal: c(a.principal, b.principal),
    externo: c(a.externo, b.externo),
    app: c(a.app, b.app),
    pasarela: c(a.pasarela, b.pasarela),
    propietarioNeto: c(a.propietarioNeto, b.propietarioNeto),
  };
}

/** Precio por debajo de la neta (input a medio digitar): comisión 0, sin lanzar. */
function desgloseSinComision(precioFinal: number, tarifaNeta: number): Desglose {
  const pasarela = porcentajeBps(aCentavos(precioFinal), BPS_PASARELA) / 100;
  return {
    precioFinal,
    tarifaNeta,
    comision: 0,
    principal: 0,
    externo: 0,
    app: 0,
    pasarela,
    propietarioNeto: tarifaNeta - pasarela,
  };
}

/**
 * Calcula el split completo de una reserva (total + mitad 1 del anticipo).
 * Usa liquidarReserva del módulo de dinero: lo que ve la UI es EXACTAMENTE
 * lo que el servidor registrará en los splits (antes usaba Math.round por
 * porcentaje y podía diferir del servidor en algunos pesos).
 */
export function calcularSplit(precioFinal: number, tarifaNeta: number): SplitReserva {
  const precio = aCentavos(Math.max(0, precioFinal));
  const neta = aCentavos(Math.max(0, tarifaNeta));
  if (precio < neta) {
    return {
      total: desgloseSinComision(precioFinal, tarifaNeta),
      porMitad: desgloseSinComision(Math.floor(precioFinal / 2), Math.floor(tarifaNeta / 2)),
    };
  }
  const liq = liquidarReserva(precio, neta);
  const m1 = desglosarMitad(liq.mitades[0]);
  const m2 = desglosarMitad(liq.mitades[1]);
  return { total: sumarDesgloses(m1, m2), porMitad: m1 };
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
