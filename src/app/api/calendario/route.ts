import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { authExigida } from "@/server/auth";
import { usuarioDePeticion } from "@/server/auth/guardia";
import { hayDb, usuarioDelPanel } from "@/server/datos/fuente";
import { bloquearDias, CalendarioError, liberarDias } from "@/server/servicios/calendario";

/**
 * Escritura del calendario del propietario (regla #14). La autorización y la
 * regla "jamás tocar reservado_app / bloqueado_ical" viven en el servicio —
 * este handler solo resuelve QUIÉN es el propietario:
 * - MODO_AUTH=exigida → sesión con rol propietario, obligatoria.
 * - dev/preview con DB sin auth → el propietario del panel (usuario semilla).
 */

const Cuerpo = z.object({
  propiedadId: z.uuid(),
  fechas: z.array(z.string()).min(1).max(92),
  accion: z.enum(["bloquear", "liberar"]),
});

export async function POST(req: Request) {
  if (!hayDb()) {
    return NextResponse.json({ error: "Demo sin base de datos" }, { status: 503 });
  }
  const json = await req.json().catch(() => null);
  const parseado = Cuerpo.safeParse(json);
  if (!parseado.success) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const db = obtenerDb();
  let propietarioId: string;
  if (authExigida()) {
    const sesion = await usuarioDePeticion();
    if (!sesion || !sesion.roles.includes("propietario")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    propietarioId = sesion.id;
  } else {
    const u = await usuarioDelPanel(db, "propietario", null);
    if (!u) return NextResponse.json({ error: "Sin datos" }, { status: 503 });
    propietarioId = u.id;
  }

  const { propiedadId, fechas, accion } = parseado.data;
  try {
    const dias =
      accion === "bloquear"
        ? await bloquearDias(db, propietarioId, propiedadId, fechas)
        : await liberarDias(db, propietarioId, propiedadId, fechas);
    return NextResponse.json({ ok: true, dias });
  } catch (e) {
    if (e instanceof CalendarioError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
