/**
 * Rate limit de ventana deslizante EN MEMORIA para endpoints públicos.
 * En serverless protege por instancia (suficiente contra abuso simple y bots
 * baratos); los límites FUERTES por identidad viven en la DB (OTP por email,
 * strikes anti-fuga). Si el piloto crece, el upgrade natural es Redis/Upstash
 * con la misma interfaz.
 */

interface Ventana {
  marcas: number[]; // timestamps (ms) de peticiones aceptadas
}

const ventanas = new Map<string, Ventana>();
const MAX_CLAVES = 10_000; // tope de memoria: por encima se resetea (fail-open)

export function permitirPeticion(
  clave: string,
  maxPorMinuto: number,
  ahora: number = Date.now(),
): boolean {
  if (ventanas.size > MAX_CLAVES) ventanas.clear();
  const v = ventanas.get(clave) ?? { marcas: [] };
  const haceUnMinuto = ahora - 60_000;
  v.marcas = v.marcas.filter((t) => t > haceUnMinuto);
  if (v.marcas.length >= maxPorMinuto) {
    ventanas.set(clave, v);
    return false;
  }
  v.marcas.push(ahora);
  ventanas.set(clave, v);
  return true;
}

/** IP del cliente detrás del proxy de Vercel. */
export function ipDePeticion(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "desconocida"
  );
}

/** Respuesta 429 estándar, o null si la petición pasa. */
export function limitar(req: Request, ruta: string, maxPorMinuto: number): Response | null {
  if (permitirPeticion(`${ruta}:${ipDePeticion(req)}`, maxPorMinuto)) return null;
  return Response.json(
    { error: "Demasiadas peticiones. Intenta en un minuto." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
