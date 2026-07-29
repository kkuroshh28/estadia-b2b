import { clamparMes, infoMes } from "@/lib/domain/paneles";
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
import type { EstadoDia } from "@/lib/domain/tipos";
import {
  COMISIONES_POR_MES,
  LINKS_DE_PAGO,
  NEGOCIACION_DEMO,
  NETO_MENSUAL_PROPIETARIO,
  PROPIEDADES,
  RESERVAS,
  SOLICITUDES,
  SPLITS_LIQUIDADOS,
  propiedadPorId,
} from "./demo";

/**
 * VITRINA sin base de datos: los paneles se llenan con la data de demo.ts
 * para que un dueño/prospecto vea la plataforma operando. En cuanto exista
 * DATABASE_URL, la data real reemplaza TODO esto automaticamente.
 */

export function demoPropietario(): DatosPropietario {
  return {
    esDemo: true,
    solicitudesDirectas: [],
    netoMes: 8_960_000,
    suscripcion: { estado: "activa", renuevaEn: "2026-08-01" },
    propiedades: PROPIEDADES,
    reservas: RESERVAS.map((r) => ({ ...r, propiedadNombre: propiedadPorId(r.propiedadId).nombre })),
    ingresosPorMes: NETO_MENSUAL_PROPIETARIO,
  };
}

export function demoPrincipal(): DatosPrincipal {
  return {
    esDemo: true,
    aliasYo: "CONDOR-472",
    solicitudes: SOLICITUDES.map((s) => ({
      ...s,
      propiedadNombre: propiedadPorId(s.propiedadId).nombre,
    })),
    reservas: RESERVAS.filter((r) => r.aliasPrincipal === "CONDOR-472").map((r) => ({
      ...r,
      propiedadNombre: propiedadPorId(r.propiedadId).nombre,
    })),
  };
}

export function demoBusquedaExterno(desde?: string, hasta?: string): DatosBusquedaExterno {
  // En la vitrina no se filtra por disponibilidad: se muestra el inventario.
  const RE = /^\d{4}-\d{2}-\d{2}$/;
  const fechas =
    desde && hasta && RE.test(desde) && RE.test(hasta) && desde < hasta
      ? {
          desde,
          hasta,
          noches: Math.max(1, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000)),
        }
      : null;
  return { esDemo: true, aliasYo: "GUACAMAYA-256", propiedades: PROPIEDADES, fechas };
}

export function demoLinksExterno(): DatosLinksExterno {
  return {
    esDemo: true,
    aliasYo: "GUACAMAYA-256",
    links: LINKS_DE_PAGO,
    saldosPendientes: [],
    tasaPago: 0.92,
    comisionesMes: 1_872_000,
  };
}

export function demoComisiones(rol: "principal" | "externo" = "principal"): DatosComisiones {
  return {
    esDemo: true,
    alias: rol === "principal" ? "CONDOR-472" : "GUACAMAYA-256",
    porMes: COMISIONES_POR_MES[rol],
    splits: SPLITS_LIQUIDADOS,
    reservasCompletadas: 14,
  };
}

export function demoNegociacion(): DatosNegociacion {
  return {
    esDemo: true,
    negociacion: {
      ...NEGOCIACION_DEMO,
      propiedadNombre: propiedadPorId(NEGOCIACION_DEMO.propiedadId).nombre,
      margenMinimo: 0,
    },
    perspectivaFija: null,
    soyPropietario: false,
  };
}

export function demoPrincipales(): DatosPrincipales {
  return {
    esDemo: true,
    propiedades: PROPIEDADES.slice(0, 3).map((p) => ({ id: p.id, nombre: p.nombre })),
    vinculos: {
      "prop-01": [
        { alias: "CONDOR-472", reservas: 21, respuestaMin: 6 },
        { alias: "CEIBA-118", reservas: 12, respuestaMin: 11 },
        { alias: "OCELOTE-903", reservas: 7, respuestaMin: 19 },
        { alias: "HALCON-227", reservas: 3, respuestaMin: 24 },
      ],
      "prop-02": [
        { alias: "CONDOR-472", reservas: 14, respuestaMin: 6 },
        { alias: "CEIBA-118", reservas: 9, respuestaMin: 11 },
        { alias: "PUMA-581", reservas: 4, respuestaMin: 15 },
      ],
      "prop-03": [
        { alias: "CONDOR-472", reservas: 11, respuestaMin: 6 },
        { alias: "CEIBA-118", reservas: 8, respuestaMin: 11 },
        { alias: "OCELOTE-903", reservas: 6, respuestaMin: 19 },
        { alias: "GUADUA-914", reservas: 2, respuestaMin: 31 },
        { alias: "PUMA-581", reservas: 1, respuestaMin: 15 },
      ],
    },
  };
}

/** Dias ocupados deterministas por propiedad y mes (la vitrina navega meses). */
function estadosDemoDelMes(
  mesIso: string,
  dias: number,
): Record<string, Partial<Record<number, EstadoDia>>> {
  const mesNum = Number(mesIso.slice(5, 7));
  const estados: Record<string, Partial<Record<number, EstadoDia>>> = {};
  PROPIEDADES.forEach((p, i) => {
    const m: Partial<Record<number, EstadoDia>> = {};
    for (let d = 1; d <= dias; d++) {
      const semilla = (d + i * 3 + mesNum * 5) % 17;
      if (semilla === 0 || semilla === 1) m[d] = "reservado_app";
      else if (semilla === 7) m[d] = "bloqueado_manual";
      else if (semilla === 12) m[d] = "bloqueado_ical";
    }
    estados[p.id] = m;
  });
  // La reserva estrella (CIR-2026-00341, 1-5 ago) siempre visible en agosto.
  if (mesIso === "2026-08") {
    estados["prop-02"] = {
      ...estados["prop-02"],
      1: "reservado_app",
      2: "reservado_app",
      3: "reservado_app",
      4: "reservado_app",
      5: "reservado_app",
    };
  }
  return estados;
}

export function demoCalendario(mesPedido?: string): DatosCalendario {
  const mesIso = clamparMes(mesPedido, hoyEnBogota().slice(0, 7));
  const info = infoMes(mesIso);
  return {
    esDemo: true,
    mes: { iso: mesIso, ...info },
    propiedades: PROPIEDADES,
    estados: estadosDemoDelMes(mesIso, info.dias),
    ical: {},
  };
}

export function demoChat(): DatosChat {
  return {
    esDemo: true,
    solicitudId: null,
    contexto: "Reserva CIR-2026-00362 · Finca Mirador del Peñol",
    aliasPrincipal: "CONDOR-472",
    aliasExterno: "COLIBRI-345",
    mensajes: [
      { id: "d1", emisorRol: "externo", texto: "Buenas. Mi cliente llega el 14 a las 3 pm, ¿la entrega es en porteria?", bloqueado: false, motivos: [] },
      { id: "d2", emisorRol: "principal", texto: "Si, en porteria con el codigo QR que genera la app cuando el semaforo este en verde.", bloqueado: false, motivos: [] },
      { id: "d3", emisorRol: "externo", texto: "Perfecto. Ya le reenvie el link del anticipo, apenas pague coordinamos.", bloqueado: false, motivos: [] },
    ],
    strikes: { principal: 0, externo: 0 },
  };
}

export function demoFicha(id: string, mesPedido?: string): DatosFicha | null {
  const propiedad = PROPIEDADES.find((p) => p.id === id);
  if (!propiedad) return null;
  const mesIso = clamparMes(mesPedido, hoyEnBogota().slice(0, 7));
  const info = infoMes(mesIso);
  const estados = estadosDemoDelMes(mesIso, info.dias)[id] ?? {};
  return {
    propiedad,
    esDemo: true,
    mesIso,
    mesTitulo: info.titulo,
    diasDelMes: info.dias,
    offsetLunes: info.offsetLunes,
    ocupados: Object.keys(estados).map(Number),
  };
}
