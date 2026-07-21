/**
 * Tipos del dominio — Marketplace B2B de Rentas Cortas (Antioquia).
 * El cliente final NUNCA es usuario: solo recibe links de pago.
 */

export type Rol = "propietario" | "principal" | "externo";

/** Máquina de estados de la reserva (ver reserva.ts para transiciones). */
export type EstadoReserva =
  | "SOLICITADA"
  | "ACEPTADA"
  | "NEGOCIACION"
  | "PRECIO_ACORDADO"
  | "LINK_1_ENVIADO"
  | "ANTICIPO_PAGADO"
  | "SALDO_LINK_ENVIADO"
  | "PAGO_COMPLETO"
  | "CHECK_IN"
  | "COMPLETADA"
  // Terminales alternos
  | "EXPIRADA"
  | "INVALIDADA"
  | "RECHAZADA"
  | "CANCELADA";

export type EstadoDia =
  | "disponible"
  | "reservado_app"
  | "bloqueado_manual"
  | "bloqueado_ical";

export type EstadoLink = "activo" | "pagado" | "expirado" | "invalidado";

export interface Propiedad {
  id: string;
  nombre: string;
  zona: string;
  municipio: string;
  tipo: "finca" | "apartamento" | "casa" | "glamping";
  capacidad: number;
  habitaciones: number;
  banos: number;
  /** Tarifa neta por noche en COP — el propietario SIEMPRE la recibe completa. */
  tarifaNetaNoche: number;
  verificada: boolean;
  /** Solo en la vista del dueño: visible u oculta para el gremio. */
  publicada?: boolean;
  amenidades: string[];
  reglas: string[];
  /** Semilla determinista para la carátula generada (sin fotos externas). */
  matiz: number;
  principalesVinculados: number; // 3–5 por regla de negocio
}

export interface Comisionista {
  alias: string; // único, irrepetible, autogenerado — la marca profesional
  rol: Exclude<Rol, "propietario">;
  reservasCompletadas: number;
  tasaRespuestaMin: number; // minutos promedio de respuesta (principal)
  tasaPagoLinks: number; // % links pagados (externo)
  desde: string; // fecha de alta
}

export interface Oferta {
  id: string;
  emisor: "principal" | "externo";
  monto: number; // precio final propuesto al cliente
  timestamp: string;
  vigenciaHoras: number;
  estado: "activa" | "contraofertada" | "aceptada" | "expirada";
}

export interface Negociacion {
  id: string;
  solicitudId: string;
  propiedadId: string;
  aliasPrincipal: string;
  aliasExterno: string;
  noches: number;
  fechas: { desde: string; hasta: string };
  tarifaNetaTotal: number;
  ofertas: Oferta[];
  precioAcordado?: number;
  rangoSugerido: { min: number; max: number }; // datos de mercado
}

export interface Solicitud {
  id: string;
  propiedadId: string;
  aliasExterno: string;
  fechas: { desde: string; hasta: string };
  noches: number;
  huespedes: number;
  estado: "pendiente" | "aceptada" | "expirada" | "rechazada";
  recibidaHace: string;
  vigenciaMin: number;
}

export interface Reserva {
  id: string;
  codigo: string;
  propiedadId: string;
  aliasPrincipal: string;
  aliasExterno: string;
  fechas: { desde: string; hasta: string };
  noches: number;
  estado: EstadoReserva;
  precioFinal: number;
  tarifaNetaTotal: number;
  checkIn: string;
}

export interface LinkDePago {
  id: string;
  reservaId: string;
  codigoReserva: string;
  propiedadNombre: string;
  mitad: 1 | 2;
  monto: number;
  estado: EstadoLink;
  vence: string;
  fechas: { desde: string; hasta: string };
}
