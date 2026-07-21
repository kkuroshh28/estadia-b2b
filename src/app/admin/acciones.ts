"use server";

import { revalidatePath } from "next/cache";
import { obtenerDb } from "@/server/db";
import { usuarioDePeticion } from "@/server/auth/guardia";
import { adminDev } from "@/server/datos/fuente";
import {
  aprobarPropiedad, editarConfiguracion, reembolsar, resolverKycManual, revertirBan,
} from "@/server/servicios/admin";

/**
 * Server actions del panel — el guard real vive en los servicios (exigirAdmin).
 * Sin MODO_AUTH (dev/preview) opera el admin de desarrollo, auditado como tal.
 */
async function actorAdmin() {
  const db = obtenerDb();
  return (await usuarioDePeticion()) ?? (await adminDev(db));
}

export async function accionAprobarPropiedad(propiedadId: string) {
  await aprobarPropiedad(obtenerDb(), await actorAdmin(), propiedadId);
  revalidatePath("/admin/verificaciones");
}

export async function accionResolverKyc(checkId: string, aprobado: boolean) {
  await resolverKycManual(obtenerDb(), await actorAdmin(), checkId, aprobado);
  revalidatePath("/admin/verificaciones");
}

export async function accionRevertirBan(usuarioId: string, confirmacion: string, motivo: string) {
  await revertirBan(obtenerDb(), await actorAdmin(), usuarioId, confirmacion, motivo);
  revalidatePath("/admin/antifuga");
}

export async function accionReembolsar(transaccionId: string, confirmacion: string) {
  await reembolsar(obtenerDb(), await actorAdmin(), transaccionId, confirmacion);
  revalidatePath("/admin/dinero");
}

export async function accionEditarConfig(clave: string, valorJson: string) {
  await editarConfiguracion(obtenerDb(), await actorAdmin(), clave, JSON.parse(valorJson));
  revalidatePath("/admin/configuracion");
}
