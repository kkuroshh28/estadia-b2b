import type {
  EstadoDia,
  LinkDePago,
  Negociacion,
  Propiedad,
  Reserva,
  Solicitud,
} from "./tipos";

/**
 * Contratos de datos de los paneles /app. El servidor los llena desde la DB
 * (usuario de la sesión) o desde la demo (sin DATABASE_URL) — la UI consume
 * el MISMO shape en ambos casos y no sabe de dónde vienen.
 */

export interface ReservaPanel extends Reserva {
  propiedadNombre: string;
}

export interface SolicitudPanel extends Solicitud {
  propiedadNombre: string;
}

export interface SplitLiquidado {
  fecha: string;
  codigo: string;
  propiedad: string;
  mitad: 1 | 2;
  comisionTotal: number;
  principal: number;
  externo: number;
  dispersado: boolean;
}

export interface DatosPropietario {
  esDemo: boolean;
  netoMes: number; // pesos, mes en curso (splits tarifa_neta reales)
  suscripcion: { estado: string; renuevaEn: string } | null;
  propiedades: Propiedad[];
  reservas: ReservaPanel[];
  ingresosPorMes: { mes: string; neto: number }[];
}

export interface DatosPrincipal {
  esDemo: boolean;
  aliasYo: string | null;
  solicitudes: SolicitudPanel[];
  reservas: ReservaPanel[];
}

export interface DatosBusquedaExterno {
  esDemo: boolean;
  aliasYo: string | null;
  propiedades: Propiedad[];
}

export interface DatosLinksExterno {
  esDemo: boolean;
  aliasYo: string | null;
  links: LinkDePago[];
  /** % de links pagados (0–1) — parte de la reputación. null = sin historial. */
  tasaPago: number | null;
  comisionesMes: number;
}

export interface DatosComisiones {
  esDemo: boolean;
  alias: string | null;
  porMes: { mes: string; monto: number }[];
  splits: SplitLiquidado[];
  reservasCompletadas: number;
}

export interface NegociacionPanel extends Negociacion {
  propiedadNombre: string;
}

export interface DatosNegociacion {
  esDemo: boolean;
  negociacion: NegociacionPanel | null;
  /** Con sesión real la perspectiva es la del usuario; en demo hay selector. */
  perspectivaFija: "principal" | "externo" | null;
}

export interface VinculoPanel {
  alias: string;
  reservas: number;
  respuestaMin: number | null; // null = aún sin datos de respuesta
}

export interface DatosPrincipales {
  esDemo: boolean;
  propiedades: { id: string; nombre: string }[];
  vinculos: Record<string, VinculoPanel[]>;
}

export interface DatosCalendario {
  esDemo: boolean;
  /** Mes mostrado: { iso: "2026-08", titulo: "Agosto 2026", dias: 31, offsetLunes: n } */
  mes: { iso: string; titulo: string; dias: number; offsetLunes: number };
  propiedades: Propiedad[];
  /** Estado por propiedad y día del mes (solo días NO disponibles). */
  estados: Record<string, Partial<Record<number, EstadoDia>>>;
}

export interface DatosFicha {
  propiedad: Propiedad;
  esDemo: boolean;
  mesIso: string; // YYYY-MM del calendario mostrado
  mesTitulo: string;
  diasDelMes: number;
  offsetLunes: number;
  ocupados: number[];
}

/** Utilidades de calendario compartidas servidor/cliente (sin dependencias). */
export function infoMes(iso: string): { titulo: string; dias: number; offsetLunes: number } {
  const [ano, mes] = iso.split("-").map(Number);
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  // getUTCDay: 0=domingo … 6=sábado → offset con semana iniciando lunes
  const dow = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const offsetLunes = (dow + 6) % 7;
  const nombre = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, 15)));
  return {
    titulo: nombre.charAt(0).toUpperCase() + nombre.slice(1),
    dias,
    offsetLunes,
  };
}
