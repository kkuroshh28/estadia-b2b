import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { AuthError, COOKIE_SESION, iniciarSesionConPassword } from "@/server/auth";
import { ipDePeticion, limitar } from "@/server/rate-limit";
import { auditoriaAdmin } from "@/server/db/schema";

const Cuerpo = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const excedido = limitar(req, "auth-password", 5);
  if (excedido) return excedido;
  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  try {
    const db = obtenerDb();
    const { token, venceEn, usuarioId } = await iniciarSesionConPassword(
      db,
      parseado.data.email,
      parseado.data.password,
    );
    // Rastro de cada ingreso con contraseña (cuenta superadmin).
    await db.insert(auditoriaAdmin).values({
      adminId: usuarioId,
      accion: "login_password",
      detalle: {
        ip: ipDePeticion(req),
        ua: req.headers.get("user-agent")?.slice(0, 200) ?? null,
      },
    });
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
