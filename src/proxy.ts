import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next 16; antes "middleware"): redirección TEMPRANA a /login cuando
 * falta la cookie de sesión en las zonas privadas. Es solo una cortesía de UX
 * (evita renderizar el panel para luego rebotar): la validación REAL de la
 * sesión sigue en el servidor (layouts/guardias + API), que es la autoridad.
 *
 * Solo actúa con MODO_AUTH=exigida; en modo piloto sin auth no toca nada.
 * El nombre de la cookie se duplica a propósito (debe coincidir con
 * COOKIE_SESION de src/server/auth): el proxy no importa módulos del servidor.
 */
const COOKIE_SESION = "estadia_sesion";

export function proxy(request: NextRequest) {
  if (process.env.MODO_AUTH !== "exigida") return NextResponse.next();
  if (request.cookies.get(COOKIE_SESION)?.value) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url), 307);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
