import type {
  Comisionista,
  LinkDePago,
  Negociacion,
  Propiedad,
  Reserva,
  Solicitud,
} from "@/lib/domain/tipos";

/**
 * Datos de demostración — piloto Oriente Antioqueño + Medellín.
 * En producción esto vive en PostgreSQL (ver supabase/schema.sql);
 * el front consume el mismo shape a través de la capa de dominio.
 */

export const PROPIEDADES: Propiedad[] = [
  {
    id: "prop-01",
    nombre: "Finca Mirador del Peñol",
    zona: "Oriente Antioqueño",
    municipio: "Guatapé",
    tipo: "finca",
    capacidad: 14,
    habitaciones: 5,
    banos: 4,
    tarifaNetaNoche: 1_450_000,
    verificada: true,
    amenidades: ["Piscina climatizada", "Vista a la represa", "Muelle privado", "BBQ", "Jacuzzi"],
    reglas: ["No fiestas después de 11 pm", "No mascotas", "Check-in 3 pm / out 12 m"],
    matiz: 158,
    principalesVinculados: 4,
  },
  {
    id: "prop-02",
    nombre: "Penthouse Provenza 1102",
    zona: "El Poblado",
    municipio: "Medellín",
    tipo: "apartamento",
    capacidad: 6,
    habitaciones: 3,
    banos: 3,
    tarifaNetaNoche: 980_000,
    verificada: true,
    amenidades: ["Rooftop privado", "Gimnasio", "Coworking", "Smart TV 75”"],
    reglas: ["Solo mayores de 25 sin familia", "No eventos"],
    matiz: 196,
    principalesVinculados: 3,
  },
  {
    id: "prop-03",
    nombre: "Casa Campestre Llanogrande",
    zona: "Oriente cercano",
    municipio: "Rionegro",
    tipo: "casa",
    capacidad: 10,
    habitaciones: 4,
    banos: 4,
    tarifaNetaNoche: 1_150_000,
    verificada: true,
    amenidades: ["Zona verde 2.000 m²", "Chimenea", "Golfito", "Parqueadero 6 autos"],
    reglas: ["Mascotas bienvenidas", "No fumar adentro"],
    matiz: 84,
    principalesVinculados: 5,
  },
  {
    id: "prop-04",
    nombre: "Glamping Bosque Nublado",
    zona: "Oriente Antioqueño",
    municipio: "El Retiro",
    tipo: "glamping",
    capacidad: 2,
    habitaciones: 1,
    banos: 1,
    tarifaNetaNoche: 620_000,
    verificada: true,
    amenidades: ["Domo geodésico", "Malla catamarán", "Telescopio", "Desayuno incluido"],
    reglas: ["Solo parejas", "Silencio después de 10 pm"],
    matiz: 122,
    principalesVinculados: 3,
  },
  {
    id: "prop-05",
    nombre: "Apartamento Laureles 501",
    zona: "Laureles–Estadio",
    municipio: "Medellín",
    tipo: "apartamento",
    capacidad: 4,
    habitaciones: 2,
    banos: 2,
    tarifaNetaNoche: 520_000,
    verificada: true,
    amenidades: ["Balcón sobre la 70", "Aire acondicionado", "Cocina completa"],
    reglas: ["No fiestas", "Máximo 4 huéspedes"],
    matiz: 28,
    principalesVinculados: 3,
  },
  {
    id: "prop-06",
    nombre: "Finca Cafetera La Loma",
    zona: "Suroeste",
    municipio: "Jardín",
    tipo: "finca",
    capacidad: 8,
    habitaciones: 4,
    banos: 3,
    tarifaNetaNoche: 890_000,
    verificada: false,
    amenidades: ["Tour de café", "Caballos", "Río privado", "Kiosco"],
    reglas: ["Check-in flexible", "Mascotas con aviso"],
    matiz: 62,
    principalesVinculados: 3,
  },
];

export const COMISIONISTAS: Comisionista[] = [
  { alias: "CONDOR-472", rol: "principal", reservasCompletadas: 38, tasaRespuestaMin: 6, tasaPagoLinks: 0, desde: "2026-01-15" },
  { alias: "CEIBA-118", rol: "principal", reservasCompletadas: 24, tasaRespuestaMin: 11, tasaPagoLinks: 0, desde: "2026-02-02" },
  { alias: "OCELOTE-903", rol: "principal", reservasCompletadas: 17, tasaRespuestaMin: 19, tasaPagoLinks: 0, desde: "2026-03-11" },
  { alias: "GUACAMAYA-256", rol: "externo", reservasCompletadas: 41, tasaRespuestaMin: 0, tasaPagoLinks: 0.92, desde: "2026-01-20" },
  { alias: "YARUMO-611", rol: "externo", reservasCompletadas: 29, tasaRespuestaMin: 0, tasaPagoLinks: 0.87, desde: "2026-02-14" },
  { alias: "COLIBRI-345", rol: "externo", reservasCompletadas: 12, tasaRespuestaMin: 0, tasaPagoLinks: 0.95, desde: "2026-04-01" },
];

export const SOLICITUDES: Solicitud[] = [
  {
    id: "sol-01",
    propiedadId: "prop-01",
    aliasExterno: "GUACAMAYA-256",
    fechas: { desde: "2026-07-17", hasta: "2026-07-20" },
    noches: 3,
    huespedes: 12,
    estado: "pendiente",
    recibidaHace: "hace 2 min",
    vigenciaMin: 28,
  },
  {
    id: "sol-02",
    propiedadId: "prop-03",
    aliasExterno: "COLIBRI-345",
    fechas: { desde: "2026-07-24", hasta: "2026-07-27" },
    noches: 3,
    huespedes: 8,
    estado: "pendiente",
    recibidaHace: "hace 9 min",
    vigenciaMin: 21,
  },
  {
    id: "sol-03",
    propiedadId: "prop-02",
    aliasExterno: "YARUMO-611",
    fechas: { desde: "2026-07-10", hasta: "2026-07-14" },
    noches: 4,
    huespedes: 5,
    estado: "aceptada",
    recibidaHace: "hace 1 h",
    vigenciaMin: 0,
  },
];

export const NEGOCIACION_DEMO: Negociacion = {
  id: "neg-01",
  solicitudId: "sol-03",
  propiedadId: "prop-01",
  aliasPrincipal: "CONDOR-472",
  aliasExterno: "GUACAMAYA-256",
  noches: 3,
  fechas: { desde: "2026-07-17", hasta: "2026-07-20" },
  tarifaNetaTotal: 4_350_000, // 3 noches × 1.450.000
  rangoSugerido: { min: 4_900_000, max: 5_400_000 },
  ofertas: [
    {
      id: "of-01",
      emisor: "externo",
      monto: 4_950_000,
      timestamp: "10:42",
      vigenciaHoras: 6,
      estado: "contraofertada",
    },
    {
      id: "of-02",
      emisor: "principal",
      monto: 5_250_000,
      timestamp: "10:51",
      vigenciaHoras: 6,
      estado: "contraofertada",
    },
  ],
};

export const RESERVAS: Reserva[] = [
  {
    id: "res-01",
    codigo: "EST-2026-00341",
    propiedadId: "prop-02",
    aliasPrincipal: "CONDOR-472",
    aliasExterno: "YARUMO-611",
    fechas: { desde: "2026-07-10", hasta: "2026-07-14" },
    noches: 4,
    estado: "PAGO_COMPLETO",
    precioFinal: 4_560_000,
    tarifaNetaTotal: 3_920_000,
    checkIn: "2026-07-10",
  },
  {
    id: "res-02",
    codigo: "EST-2026-00358",
    propiedadId: "prop-03",
    aliasPrincipal: "CEIBA-118",
    aliasExterno: "GUACAMAYA-256",
    fechas: { desde: "2026-07-31", hasta: "2026-08-03" },
    noches: 3,
    estado: "ANTICIPO_PAGADO",
    precioFinal: 4_050_000,
    tarifaNetaTotal: 3_450_000,
    checkIn: "2026-07-31",
  },
  {
    id: "res-03",
    codigo: "EST-2026-00362",
    propiedadId: "prop-01",
    aliasPrincipal: "CONDOR-472",
    aliasExterno: "COLIBRI-345",
    fechas: { desde: "2026-08-14", hasta: "2026-08-17" },
    noches: 3,
    estado: "LINK_1_ENVIADO",
    precioFinal: 5_100_000,
    tarifaNetaTotal: 4_350_000,
    checkIn: "2026-08-14",
  },
  {
    id: "res-04",
    codigo: "EST-2026-00287",
    propiedadId: "prop-04",
    aliasPrincipal: "OCELOTE-903",
    aliasExterno: "YARUMO-611",
    fechas: { desde: "2026-06-20", hasta: "2026-06-22" },
    noches: 2,
    estado: "COMPLETADA",
    precioFinal: 1_480_000,
    tarifaNetaTotal: 1_240_000,
    checkIn: "2026-06-20",
  },
];

export const LINKS_DE_PAGO: LinkDePago[] = [
  {
    id: "lnk-7f3a",
    reservaId: "res-03",
    codigoReserva: "EST-2026-00362",
    propiedadNombre: "Finca Mirador del Peñol",
    mitad: 1,
    monto: 2_550_000,
    estado: "activo",
    vence: "hoy 6:00 pm",
    fechas: { desde: "2026-08-14", hasta: "2026-08-17" },
  },
  {
    id: "lnk-2c91",
    reservaId: "res-02",
    codigoReserva: "EST-2026-00358",
    propiedadNombre: "Casa Campestre Llanogrande",
    mitad: 2,
    monto: 2_025_000,
    estado: "activo",
    vence: "29 jul, 3:00 pm",
    fechas: { desde: "2026-07-31", hasta: "2026-08-03" },
  },
  {
    id: "lnk-9d04",
    reservaId: "res-01",
    codigoReserva: "EST-2026-00341",
    propiedadNombre: "Penthouse Provenza 1102",
    mitad: 2,
    monto: 2_280_000,
    estado: "pagado",
    vence: "—",
    fechas: { desde: "2026-07-10", hasta: "2026-07-14" },
  },
  {
    id: "lnk-x882",
    reservaId: "res-x",
    codigoReserva: "EST-2026-00355",
    propiedadNombre: "Finca Mirador del Peñol",
    mitad: 1,
    monto: 2_600_000,
    estado: "invalidado",
    vence: "—",
    fechas: { desde: "2026-07-31", hasta: "2026-08-03" },
  },
];

/**
 * Días OCUPADOS de julio 2026 por propiedad (reservas pagadas + iCal + bloqueos
 * manuales). En búsqueda y ficha estos días están deshabilitados: ni clickeables.
 */
export const DIAS_OCUPADOS_JULIO: Record<string, number[]> = {
  "prop-01": [4, 5, 24, 25, 26],
  "prop-02": [10, 11, 12, 13],
  "prop-03": [20, 31],
  "prop-04": [1, 2],
  "prop-05": [3, 4],
  "prop-06": [15, 16, 17],
};

/** Historial de splits liquidados (para "Mis comisiones"). */
import type { SplitLiquidado } from "@/lib/domain/paneles";
export type { SplitLiquidado };

export const SPLITS_LIQUIDADOS: SplitLiquidado[] = [
  { fecha: "01 jul", codigo: "EST-2026-00341", propiedad: "Penthouse Provenza 1102", mitad: 2, comisionTotal: 320_000, principal: 160_000, externo: 128_000, dispersado: true },
  { fecha: "28 jun", codigo: "EST-2026-00358", propiedad: "Casa Campestre Llanogrande", mitad: 1, comisionTotal: 300_000, principal: 150_000, externo: 120_000, dispersado: true },
  { fecha: "24 jun", codigo: "EST-2026-00341", propiedad: "Penthouse Provenza 1102", mitad: 1, comisionTotal: 320_000, principal: 160_000, externo: 128_000, dispersado: true },
  { fecha: "20 jun", codigo: "EST-2026-00287", propiedad: "Glamping Bosque Nublado", mitad: 2, comisionTotal: 120_000, principal: 60_000, externo: 48_000, dispersado: true },
  { fecha: "18 jun", codigo: "EST-2026-00287", propiedad: "Glamping Bosque Nublado", mitad: 1, comisionTotal: 120_000, principal: 60_000, externo: 48_000, dispersado: true },
  { fecha: "12 jun", codigo: "EST-2026-00274", propiedad: "Finca Mirador del Peñol", mitad: 2, comisionTotal: 410_000, principal: 205_000, externo: 164_000, dispersado: true },
];

export const COMISIONES_POR_MES = [
  { mes: "Feb", principal: 980_000, externo: 784_000 },
  { mes: "Mar", principal: 1_420_000, externo: 1_136_000 },
  { mes: "Abr", principal: 1_150_000, externo: 920_000 },
  { mes: "May", principal: 1_890_000, externo: 1_512_000 },
  { mes: "Jun", principal: 2_140_000, externo: 1_712_000 },
  { mes: "Jul", principal: 2_340_000, externo: 1_872_000 },
];

export function propiedadPorId(id: string): Propiedad {
  const p = PROPIEDADES.find((x) => x.id === id);
  if (!p) throw new Error(`Propiedad no encontrada: ${id}`);
  return p;
}
