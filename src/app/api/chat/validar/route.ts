import { NextResponse } from "next/server";
import { z } from "zod";
import { validarContenidoServidor } from "@/server/servicios/antifuga";
import { limitar } from "@/server/rate-limit";
import { authExigida } from "@/server/auth";
import { usuarioDePeticion } from "@/server/auth/guardia";

/**
 * Validación anti-fuga EN SERVIDOR. El cliente muestra el resultado como UX,
 * pero la decisión de bloquear vive aquí: un cliente modificado no puede
 * saltarse el filtro. Con DB conectada, este endpoint además persiste el
 * intento y ejecuta strikes/ban (src/server/servicios/antifuga.procesarMensaje).
 */

const Cuerpo = z.object({
  texto: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const excedido = limitar(req, "chat-validar", 30);
  if (excedido) return excedido;
  // Sin sesión no se puede "entrenar" evasiones contra el filtro.
  if (authExigida() && !(await usuarioDePeticion())) {
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parseado = Cuerpo.safeParse(json);
  if (!parseado.success) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const resultado = validarContenidoServidor(parseado.data.texto);
  return NextResponse.json(resultado);
}
