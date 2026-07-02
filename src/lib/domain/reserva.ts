import type { EstadoReserva } from "./tipos";

/**
 * Máquina de estados de la reserva (§5 de la especificación).
 * Reglas críticas:
 *  - Sin holds: hasta que entre el Pago 1, las fechas siguen libres para cualquiera.
 *  - El primero que paga, gana: el webhook del Pago 1 bloquea calendario e
 *    invalida en el mismo instante cualquier link competidor por las mismas fechas.
 *  - Sin "Pago completo ✓" no hay entrega de llaves/códigos.
 */
export const TRANSICIONES: Record<EstadoReserva, EstadoReserva[]> = {
  SOLICITADA: ["ACEPTADA", "RECHAZADA", "EXPIRADA"],
  ACEPTADA: ["NEGOCIACION", "EXPIRADA"],
  NEGOCIACION: ["PRECIO_ACORDADO", "EXPIRADA"],
  PRECIO_ACORDADO: ["LINK_1_ENVIADO", "EXPIRADA"],
  LINK_1_ENVIADO: ["ANTICIPO_PAGADO", "EXPIRADA", "INVALIDADA"],
  ANTICIPO_PAGADO: ["SALDO_LINK_ENVIADO", "CANCELADA"],
  SALDO_LINK_ENVIADO: ["PAGO_COMPLETO", "CANCELADA"],
  PAGO_COMPLETO: ["CHECK_IN", "CANCELADA"],
  CHECK_IN: ["COMPLETADA"],
  COMPLETADA: [],
  EXPIRADA: [],
  INVALIDADA: [],
  RECHAZADA: [],
  CANCELADA: [],
};

export const ESTADOS_TERMINALES: EstadoReserva[] = [
  "COMPLETADA",
  "EXPIRADA",
  "INVALIDADA",
  "RECHAZADA",
  "CANCELADA",
];

/** Momento exacto del bloqueo de calendario: al confirmar el Pago 1 por webhook. */
export const ESTADO_BLOQUEA_CALENDARIO: EstadoReserva = "ANTICIPO_PAGADO";

export function puedeTransicionar(desde: EstadoReserva, hacia: EstadoReserva): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

/** Solo con pago completo se autoriza la entrega (semáforo verde). */
export function entregaAutorizada(estado: EstadoReserva): boolean {
  return estado === "PAGO_COMPLETO" || estado === "CHECK_IN" || estado === "COMPLETADA";
}

export function calendarioBloqueado(estado: EstadoReserva): boolean {
  return (
    ["ANTICIPO_PAGADO", "SALDO_LINK_ENVIADO", "PAGO_COMPLETO", "CHECK_IN", "COMPLETADA"] as EstadoReserva[]
  ).includes(estado);
}

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  SOLICITADA: "Solicitada",
  ACEPTADA: "Aceptada",
  NEGOCIACION: "En negociación",
  PRECIO_ACORDADO: "Precio acordado",
  LINK_1_ENVIADO: "Link 1 enviado",
  ANTICIPO_PAGADO: "Anticipo pagado",
  SALDO_LINK_ENVIADO: "Link saldo enviado",
  PAGO_COMPLETO: "Pago completo ✓",
  CHECK_IN: "Check-in",
  COMPLETADA: "Completada",
  EXPIRADA: "Expirada",
  INVALIDADA: "Invalidada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
};

/** Progreso 0–100 para la línea de tiempo del semáforo. */
export function progresoReserva(estado: EstadoReserva): number {
  const camino: EstadoReserva[] = [
    "SOLICITADA",
    "ACEPTADA",
    "NEGOCIACION",
    "PRECIO_ACORDADO",
    "LINK_1_ENVIADO",
    "ANTICIPO_PAGADO",
    "SALDO_LINK_ENVIADO",
    "PAGO_COMPLETO",
    "CHECK_IN",
    "COMPLETADA",
  ];
  const idx = camino.indexOf(estado);
  if (idx === -1) return 0; // terminal alterno
  return Math.round((idx / (camino.length - 1)) * 100);
}
