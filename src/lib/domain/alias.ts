/**
 * Servicio de alias anónimos (§3.2).
 * Generado al completar el registro: aleatorio, único global, irrepetible para
 * siempre (un alias baneado jamás se reutiliza). Sin relación con datos personales.
 * En producción la unicidad se garantiza en DB (índice único + tabla de retirados).
 */

const FAUNA_FLORA = [
  "CONDOR", "CEIBA", "GUACAMAYA", "YARUMO", "OCELOTE", "ORQUIDEA", "TUCAN",
  "GUADUA", "JAGUAR", "HELICONIA", "COLIBRI", "ROBLE", "PUMA", "CATLEYA",
  "TORTUGA", "SAMAN", "HALCON", "BAMBU", "NUTRIA", "CEDRO", "IGUANA",
  "MANGLE", "GAVILAN", "LAUREL", "TIGRILLO", "ARRAYAN", "BUHO", "CAOBA",
];

export function generarAlias(aleatorio: () => number = Math.random): string {
  const palabra = FAUNA_FLORA[Math.floor(aleatorio() * FAUNA_FLORA.length)];
  const numero = Math.floor(aleatorio() * 900) + 100; // 100–999
  return `${palabra}-${numero}`;
}

export function esAliasValido(alias: string): boolean {
  return /^[A-Z]{3,12}-\d{3}$/.test(alias);
}
