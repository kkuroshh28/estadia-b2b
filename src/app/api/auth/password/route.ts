import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { AuthError, COOKIE_SESION, iniciarSesionConPassword } from "@/server/auth";
import { limitar } from "@/server/rate-limit";

const Cuerpo = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const excedido = limitar(req, "auth-password", 5);
  if (excedido) return excedido;
  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  try {
    const { token, venceEn } = await iniciarSesionConPassword(
      obtenerDb(),
      parseado.data.email,
      parseado.data.password,
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
