import {
  DIAS_OCUPADOS_JULIO,
  LINKS_DE_PAGO,
  NEGOCIACION_DEMO,
  PROPIEDADES,
  RESERVAS,
  SOLICITUDES,
  SPLITS_LIQUIDADOS,
  propiedadPorId,
} from "./demo";
import { infoMes } from "@/lib/domain/paneles";
import type {
  DatosBusquedaExterno,
  DatosCalendario,
  DatosComisiones,
  DatosFicha,
  DatosLinksExterno,
  DatosNegociacion,
  DatosPrincipal,
  DatosPrincipales,
  DatosPropietario,
} from "@/lib/domain/paneles";
import type { EstadoDia } from "@/lib/domain/tipos";

/** Constructores de la demo pública — mismo shape que la DB real. */

const NETO_MENSUAL_DEMO = [
  { mes: "Feb", neto: 4_820_000 },
  { mes: "Mar", neto: 6_940_000 },
  { mes: "Abr", neto: 5_610_000 },
  { mes: "May", neto: 9_230_000 },
  { mes: "Jun", neto: 10_480_000 },
  { mes: "Jul", neto: 8_960_000 },
];

const COMISIONES_MES_DEMO: Record<"principal" | "externo", { mes: string; monto: number }[]> = {
  principal: [
    { mes: "Feb", monto: 980_000 },
    { mes: "Mar", monto: 1_420_000 },
    { mes: "Abr", monto: 1_150_000 },
    { mes: "May", monto: 1_890_000 },
    { mes: "Jun", monto: 2_140_000 },
    { mes: "Jul", monto: 2_340_000 },
  ],
  externo: [
    { mes: "Feb", monto: 784_000 },
    { mes: "Mar", monto: 1_136_000 },
    { mes: "Abr", monto: 920_000 },
    { mes: "May", monto: 1_512_000 },
    { mes: "Jun", monto: 1_712_000 },
    { mes: "Jul", monto: 1_872_000 },
  ],
};

export function demoPropietario(): DatosPropietario {
  return {
    esDemo: true,
    netoMes: 8_960_000,
    suscripcion: { estado: "activa", renuevaEn: "2026-08-01" },
    propiedades: PROPIEDADES,
    reservas: RESERVAS.map((r) => ({ ...r, propiedadNombre: propiedadPorId(r.propiedadId).nombre })),
    ingresosPorMes: NETO_MENSUAL_DEMO,
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

export function demoBusquedaExterno(): DatosBusquedaExterno {
  return { esDemo: true, aliasYo: "GUACAMAYA-256", propiedades: PROPIEDADES };
}

export function demoLinksExterno(): DatosLinksExterno {
  return {
    esDemo: true,
    aliasYo: "GUACAMAYA-256",
    links: LINKS_DE_PAGO,
    tasaPago: 0.92,
    comisionesMes: 1_872_000,
  };
}

export function demoComisiones(rol: "principal" | "externo"): DatosComisiones {
  return {
    esDemo: true,
    alias: rol === "principal" ? "CONDOR-472" : "GUACAMAYA-256",
    porMes: COMISIONES_MES_DEMO[rol],
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
    },
    perspectivaFija: null,
  };
}

export function demoPrincipales(): DatosPrincipales {
  return {
    esDemo: true,
    propiedades: PROPIEDADES.slice(0, 2).map((p) => ({ id: p.id, nombre: p.nombre })),
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
    },
  };
}

export function demoCalendario(): DatosCalendario {
  const estados: Record<string, Partial<Record<number, EstadoDia>>> = {
    "prop-01": { 4: "bloqueado_manual", 5: "bloqueado_manual", 24: "bloqueado_ical", 25: "bloqueado_ical", 26: "bloqueado_ical" },
    "prop-02": { 10: "reservado_app", 11: "reservado_app", 12: "reservado_app", 13: "reservado_app" },
    "prop-03": { 20: "bloqueado_manual", 31: "reservado_app" },
    "prop-04": { 1: "bloqueado_manual", 2: "bloqueado_manual" },
    "prop-05": { 3: "bloqueado_ical", 4: "bloqueado_ical" },
    "prop-06": { 15: "bloqueado_manual", 16: "bloqueado_manual", 17: "bloqueado_manual" },
  };
  return {
    esDemo: true,
    mes: { iso: "2026-07", ...infoMes("2026-07") },
    propiedades: PROPIEDADES,
    estados,
  };
}

export function demoFicha(id: string): DatosFicha | null {
  const propiedad = PROPIEDADES.find((p) => p.id === id);
  if (!propiedad) return null;
  const info = infoMes("2026-07");
  return {
    propiedad,
    mesTitulo: info.titulo,
    diasDelMes: info.dias,
    offsetLunes: info.offsetLunes,
    ocupados: DIAS_OCUPADOS_JULIO[id] ?? [],
  };
}
