import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerDb } from "@/server/db";
import { obtenerKyc } from "@/server/adaptadores/kyc";
import { hmacFirma } from "@/server/crypto";

/**
 * Callback del proveedor KYC (o del simulador en desarrollo).
 * Firmado con KYC_CALLBACK_SECRET para que nadie apruebe usuarios por curl.
 * El estado del usuario SOLO se mueve por aquí.
 */
const Cuerpo = z.object({
  checkId: z.string().min(4),
  aprobado: z.boolean(),
  biometriaProveedorId: z.string().optional(),
});

export async function POST(req: Request) {
  const crudo = await req.text();
  const secreto = process.env.KYC_CALLBACK_SECRET ?? "dev-kyc-secret";
  if (hmacFirma(crudo, secreto) !== (req.headers.get("x-firma-kyc") ?? "")) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }
  const parseado = Cuerpo.safeParse(JSON.parse(crudo));
  if (!parseado.success) return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const estado = await obtenerKyc().procesarResultado(obtenerDb(), parseado.data);
  return NextResponse.json({ estado });
}
