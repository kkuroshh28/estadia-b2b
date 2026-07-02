import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { obtenerDb } from "../db";
import {
  authExigida,
  COOKIE_SESION,
  exigirAdmin,
  exigirRol,
  validarSesion,
  type Seccion,
  type UsuarioSesion,
} from "./index";

/**
 * Guard de sección para layouts de servidor. Con MODO_AUTH=exigida valida
 * sesión y rol EN SERVIDOR; sin él, la app corre como demo pública.
 */
export async function protegerSeccion(seccion: Seccion): Promise<UsuarioSesion | null> {
  if (!authExigida()) return null; // modo demo
  const jar = await cookies();
  const usuario = await validarSesion(obtenerDb(), jar.get(COOKIE_SESION)?.value);
  try {
    return exigirRol(usuario, seccion);
  } catch {
    redirect(usuario ? "/app" : "/login");
  }
}

/** Guard admin: rol admin + sesión elevada con TOTP. */
export async function protegerAdmin(): Promise<UsuarioSesion | null> {
  if (!authExigida()) return null;
  const jar = await cookies();
  const usuario = await validarSesion(obtenerDb(), jar.get(COOKIE_SESION)?.value);
  try {
    return exigirAdmin(usuario);
  } catch {
    redirect(usuario?.roles.includes("admin") ? "/admin/2fa" : "/login");
  }
}

/** Usuario de un route handler (para endpoints que exigen rol). */
export async function usuarioDePeticion(): Promise<UsuarioSesion | null> {
  const jar = await cookies();
  return validarSesion(obtenerDb(), jar.get(COOKIE_SESION)?.value);
}
