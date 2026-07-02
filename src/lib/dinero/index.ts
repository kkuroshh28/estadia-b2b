/**
 * MÓDULO CENTRAL DE DINERO — regla suprema: corrección financiera.
 *
 * Todo dinero se representa como ENTEROS de centavos COP. Jamás flotantes.
 * Los splits SIEMPRE suman exacto: el residuo de redondeo se asigna por
 * política explícita (a la plataforma), nunca se pierde ni se duplica.
 */

/** Centavos COP. Marca nominal para no mezclar con números cualesquiera. */
export type Centavos = number & { readonly __marca?: "centavos" };

export class DineroInvalidoError extends Error {}

/** Valida que un valor sea un entero seguro de centavos. */
export function centavos(valor: number): Centavos {
  if (!Number.isSafeInteger(valor)) {
    throw new DineroInvalidoError(
      `Monto inválido: ${valor} — el dinero se representa solo en enteros de centavos`,
    );
  }
  return valor as Centavos;
}

export function pesosACentavos(pesos: number): Centavos {
  // Acepta pesos con hasta 2 decimales (p. ej. de un input); redondea a centavo.
  const c = Math.round(pesos * 100);
  return centavos(c);
}

export function sumar(...montos: Centavos[]): Centavos {
  return centavos(montos.reduce((a, b) => a + b, 0));
}

export function restar(a: Centavos, b: Centavos): Centavos {
  return centavos(a - b);
}

/** Formatea centavos como COP es-CO (los centavos no circulan: se muestra el peso). */
export function formatear(monto: Centavos): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(monto / 100));
}

/** Porcentaje en basis points (1% = 100 bps) para evitar flotantes en configuración. */
export function porcentajeBps(monto: Centavos, bps: number): Centavos {
  if (!Number.isSafeInteger(bps) || bps < 0) {
    throw new DineroInvalidoError(`Basis points inválidos: ${bps}`);
  }
  // Redondeo half-up determinista.
  return centavos(Math.round((monto * bps) / 10_000));
}

// ─── Split del modelo de negocio ─────────────────────────────────────────────

export const BPS_PRINCIPAL = 5_000; // 50%
export const BPS_EXTERNO = 4_000; // 40%
export const BPS_APP = 1_000; // 10%
export const BPS_PASARELA = 300; // ~3%

export interface SplitComision {
  comision: Centavos;
  principal: Centavos;
  externo: Centavos;
  app: Centavos;
}

/**
 * Reparte la comisión 50/40/10 con suma EXACTA.
 * Política de residuo: principal y externo se redondean hacia abajo;
 * la plataforma absorbe el residuo (queda con >= su 10% teórico − 2 centavos,
 * y la suma cuadra al centavo SIEMPRE).
 */
export function repartirComision(comision: Centavos): SplitComision {
  if (comision < 0) throw new DineroInvalidoError("La comisión no puede ser negativa");
  const principal = centavos(Math.floor((comision * BPS_PRINCIPAL) / 10_000));
  const externo = centavos(Math.floor((comision * BPS_EXTERNO) / 10_000));
  const app = centavos(comision - principal - externo); // residuo a la plataforma
  return { comision, principal, externo, app };
}

export interface LiquidacionMitad {
  /** Lo que paga el cliente en esta mitad. */
  montoCliente: Centavos;
  /** Tarifa neta correspondiente a esta mitad (intocable, antes de pasarela). */
  tarifaNeta: Centavos;
  split: SplitComision;
  /** Costo de pasarela estimado sobre el monto procesado — lo asume el propietario. */
  pasarela: Centavos;
  /** Neto que recibe el propietario en esta mitad. */
  propietarioNeto: Centavos;
}

export interface LiquidacionReserva {
  precioFinal: Centavos;
  tarifaNetaTotal: Centavos;
  comisionTotal: Centavos;
  mitades: [LiquidacionMitad, LiquidacionMitad];
}

/**
 * Liquida una reserva completa en sus dos mitades 50/50.
 * Invariantes garantizados (testeados):
 *  - mitad1.montoCliente + mitad2.montoCliente === precioFinal (exacto)
 *  - mitad1.tarifaNeta + mitad2.tarifaNeta === tarifaNetaTotal (exacto)
 *  - por mitad: tarifaNeta + split.comision === montoCliente (exacto)
 *  - por split: principal + externo + app === comision (exacto)
 * La mitad 2 lleva el centavo impar si el precio no es par (política explícita).
 */
export function liquidarReserva(
  precioFinal: Centavos,
  tarifaNetaTotal: Centavos,
): LiquidacionReserva {
  if (precioFinal < tarifaNetaTotal) {
    throw new DineroInvalidoError(
      "El precio final no puede ser inferior a la tarifa neta del propietario",
    );
  }
  const comisionTotal = restar(precioFinal, tarifaNetaTotal);

  const monto1 = centavos(Math.floor(precioFinal / 2));
  const monto2 = restar(precioFinal, monto1);
  const neta1 = centavos(Math.floor(tarifaNetaTotal / 2));
  const neta2 = restar(tarifaNetaTotal, neta1);

  const mitad = (montoCliente: Centavos, tarifaNeta: Centavos): LiquidacionMitad => {
    const split = repartirComision(restar(montoCliente, tarifaNeta));
    const pasarela = porcentajeBps(montoCliente, BPS_PASARELA);
    return {
      montoCliente,
      tarifaNeta,
      split,
      pasarela,
      propietarioNeto: restar(tarifaNeta, pasarela),
    };
  };

  return {
    precioFinal,
    tarifaNetaTotal,
    comisionTotal,
    mitades: [mitad(monto1, neta1), mitad(monto2, neta2)],
  };
}
