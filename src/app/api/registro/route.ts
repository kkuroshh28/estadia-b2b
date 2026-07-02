import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { registrarUsuario, RegistroError } from "@/server/servicios/registro";

const Cuerpo = z.object({
  nombreReal: z.string().min(5).max(120),
  cedula: z.string().min(6).max(15).regex(/^[\d.]+$/),
  email: z.string().email(),
  telefono: z.string().min(10).max(15),
  rol: z.enum(["propietario", "principal", "externo"]),
});

export async function POST(req: Request) {
  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) {
    return NextResponse.json({ error: "Datos de registro inválidos" }, { status: 400 });
  }
  try {
    const r = await registrarUsuario(obtenerDb(), parseado.data);
    return NextResponse.json({ ok: true, alias: r.alias, kycCheckId: r.kycCheckId });
  } catch (e) {
    if (e instanceof RegistroError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
