import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { AuthError, COOKIE_SESION, elevarAdmin } from "@/server/auth";

const Cuerpo = z.object({ codigo: z.string().length(6) });

export async function POST(req: Request) {
  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const jar = await cookies();
  const token = jar.get(COOKIE_SESION)?.value;
  if (!token) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  try {
    await elevarAdmin(obtenerDb(), token, parseado.data.codigo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
