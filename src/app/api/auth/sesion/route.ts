import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { AuthError, cerrarSesion, COOKIE_SESION, verificarOtpYCrearSesion } from "@/server/auth";

const Cuerpo = z.object({ email: z.string().email(), codigo: z.string().length(6) });

export async function POST(req: Request) {
  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  try {
    const { token, venceEn } = await verificarOtpYCrearSesion(
      obtenerDb(),
      parseado.data.email,
      parseado.data.codigo,
    );
    const jar = await cookies();
    jar.set(COOKIE_SESION, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: venceEn,
      path: "/",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function DELETE() {
  const jar = await cookies();
  await cerrarSesion(obtenerDb(), jar.get(COOKIE_SESION)?.value);
  jar.delete(COOKIE_SESION);
  return NextResponse.json({ ok: true });
}
