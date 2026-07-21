import { infoMes } from "@/lib/domain/paneles";
import { hoyEnBogota } from "@/lib/fechas";
import type {
  DatosBusquedaExterno,
  DatosCalendario,
  DatosChat,
  DatosComisiones,
  DatosFicha,
  DatosLinksExterno,
  DatosNegociacion,
  DatosPrincipal,
  DatosPrincipales,
  DatosPropietario,
} from "@/lib/domain/paneles";

/**
 * SIN base de datos conectada la plataforma no muestra datos: estos
 * constructores devuelven estructuras VACÍAS (cero data ficticia) y cada
 * panel enseña su estado vacío honesto. Con DATABASE_URL, la data es real.
 */

export function demoPropietario(): DatosPropietario {
  return {
    esDemo: true,
    netoMes: 0,
    suscripcion: null,
    propiedades: [],
    reservas: [],
    ingresosPorMes: [],
  };
}

export function demoPrincipal(): DatosPrincipal {
  return { esDemo: true, aliasYo: null, solicitudes: [], reservas: [] };
}

export function demoBusquedaExterno(): DatosBusquedaExterno {
  return { esDemo: true, aliasYo: null, propiedades: [] };
}

export function demoLinksExterno(): DatosLinksExterno {
  return {
    esDemo: true,
    aliasYo: null,
    links: [],
    saldosPendientes: [],
    tasaPago: null,
    comisionesMes: 0,
  };
}

export function demoComisiones(): DatosComisiones {
  return { esDemo: true, alias: null, porMes: [], splits: [], reservasCompletadas: 0 };
}

export function demoNegociacion(): DatosNegociacion {
  return { esDemo: true, negociacion: null, perspectivaFija: null };
}

export function demoPrincipales(): DatosPrincipales {
  return { esDemo: true, propiedades: [], vinculos: {} };
}

export function demoCalendario(): DatosCalendario {
  const mes = hoyEnBogota().slice(0, 7);
  return { esDemo: true, mes: { iso: mes, ...infoMes(mes) }, propiedades: [], estados: {} };
}

export function demoChat(): DatosChat {
  return {
    esDemo: true,
    solicitudId: null,
    contexto: "Sin conversaciones activas",
    aliasPrincipal: "—",
    aliasExterno: "—",
    mensajes: [],
    strikes: { principal: 0, externo: 0 },
  };
}

export function demoFicha(): DatosFicha | null {
  return null; // sin DB no hay propiedades que mostrar
}
