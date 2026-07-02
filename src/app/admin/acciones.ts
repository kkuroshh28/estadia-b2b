"use server";

import { revalidatePath } from "next/cache";
import { obtenerDb } from "@/server/db";
import { usuarioDePeticion } from "@/server/auth/guardia";
import {
  aprobarPropiedad, editarConfiguracion, reembolsar, resolverKycManual, revertirBan,
} from "@/server/servicios/admin";

/** Server actions del panel — el guard real vive en los servicios (exigirAdmin). */

export async function accionAprobarPropiedad(propiedadId: string) {
  await aprobarPropiedad(obtenerDb(), await usuarioDePeticion(), propiedadId);
  revalidatePath("/admin/verificaciones");
}

export async function accionResolverKyc(checkId: string, aprobado: boolean) {
  await resolverKycManual(obtenerDb(), await usuarioDePeticion(), checkId, aprobado);
  revalidatePath("/admin/verificaciones");
}

export async function accionRevertirBan(usuarioId: string, confirmacion: string, motivo: string) {
  await revertirBan(obtenerDb(), await usuarioDePeticion(), usuarioId, confirmacion, motivo);
  revalidatePath("/admin/antifuga");
}

export async function accionReembolsar(transaccionId: string, confirmacion: string) {
  await reembolsar(obtenerDb(), await usuarioDePeticion(), transaccionId, confirmacion);
  revalidatePath("/admin/dinero");
}

export async function accionEditarConfig(clave: string, valorJson: string) {
  await editarConfiguracion(obtenerDb(), await usuarioDePeticion(), clave, JSON.parse(valorJson));
  revalidatePath("/admin/configuracion");
}
