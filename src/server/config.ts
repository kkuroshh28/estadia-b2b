/**
 * Postura de configuración FAIL-CLOSED.
 *
 * En desarrollo/tests los secretos tienen defaults cómodos. En PRODUCCIÓN
 * (NODE_ENV=production con base de datos real) esos defaults son un agujero:
 * la clave de cifrado, los secretos de cron/KYC y el bypass de auth quedarían
 * en valores públicos del repo. Estas funciones LANZAN en ese escenario en vez
 * de degradar en silencio.
 */

/** ¿Estamos en un despliegue de producción con DB real? */
export function esProduccionReal(): boolean {
  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

/**
 * Devuelve el valor del secreto. En producción real, LANZA si falta (jamás
 * degrada al default dev). En dev/test devuelve undefined y el caller usa su
 * default local.
 */
export function secretoObligatorio(nombre: string): string | undefined {
  const valor = process.env[nombre];
  if (valor) return valor;
  if (esProduccionReal()) {
    throw new Error(
      `Configuración insegura: falta ${nombre} en producción. ` +
        `Este secreto es obligatorio (fail-closed) — configúralo antes de desplegar.`,
    );
  }
  return undefined;
}

/**
 * Los simuladores de pago/KYC (que fabrican eventos "aprobados" sin dinero ni
 * verificación real) JAMÁS deben responder en producción, aunque el driver
 * siga en "simulado" por olvido de configuración.
 */
export function simuladorPermitido(): boolean {
  return !esProduccionReal();
}

/**
 * En producción real, sin MODO_AUTH=exigida toda la app opera con usuarios
 * semilla (bypass de auth pensado solo para la demo). Esto lo detecta.
 */
export function authObligatoriaFaltante(): boolean {
  return esProduccionReal() && process.env.MODO_AUTH !== "exigida";
}

/** Autoriza un request de cron por su Bearer CRON_SECRET (fail-closed en prod). */
export function cronAutorizado(req: Request): boolean {
  const secreto = secretoObligatorio("CRON_SECRET") ?? "dev-cron-secret";
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secreto}`;
}
