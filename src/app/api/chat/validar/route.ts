import { NextResponse } from "next/server";
import { z } from "zod";
import { validarContenidoServidor } from "@/server/servicios/antifuga";

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
  const json = await req.json().catch(() => null);
  const parseado = Cuerpo.safeParse(json);
  if (!parseado.success) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const resultado = validarContenidoServidor(parseado.data.texto);
  return NextResponse.json(resultado);
}
