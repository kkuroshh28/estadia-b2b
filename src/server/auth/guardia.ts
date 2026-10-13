import { cache } from "react";
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
 * Sesión de la petición, memoizada con `cache` de React: layout, guard de
 * sección y página comparten UNA sola consulta por render (antes eran 3-4).
 */
export const sesionActual = cache(async (): Promise<UsuarioSesion | null> => {
  const jar = await cookies();
  return validarSesion(obtenerDb(), jar.get(COOKIE_SESION)?.value);
});

/**
 * Guard de sección para layouts de servidor. Con MODO_AUTH=exigida valida
 * sesión y rol EN SERVIDOR; sin él, la app corre como demo pública.
 */
export async function protegerSeccion(seccion: Seccion): Promise<UsuarioSesion | null> {
  if (!authExigida()) return null; // modo demo
  const usuario = await sesionActual();
  try {
    return exigirRol(usuario, seccion);
  } catch {
    redirect(usuario ? "/app" : "/login");
  }
}

/** Guard admin: rol admin + sesión elevada con TOTP. */
export async function protegerAdmin(): Promise<UsuarioSesion | null> {
  if (!authExigida()) return null;
  const usuario = await sesionActual();
  try {
    return exigirAdmin(usuario);
  } catch {
    redirect(usuario?.roles.includes("admin") ? "/admin/2fa" : "/login");
  }
}

/** Usuario de un route handler (para endpoints que exigen rol). */
export async function usuarioDePeticion(): Promise<UsuarioSesion | null> {
  return sesionActual();
}
