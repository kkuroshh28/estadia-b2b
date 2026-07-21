import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { AuthError, solicitarOtp } from "@/server/auth";
import { limitar } from "@/server/rate-limit";

const Cuerpo = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  // Por IP además del límite por email (fuerza bruta distribuida en un solo correo).
  const excedido = limitar(req, "auth-otp", 10);
  if (excedido) return excedido;
  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  try {
    await solicitarOtp(obtenerDb(), parseado.data.email);
    // Respuesta idéntica exista o no la cuenta (no enumerar usuarios).
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
}
