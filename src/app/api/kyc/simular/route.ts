import { NextResponse } from "next/server";
import { z } from "zod";
import { hmacFirma } from "@/server/crypto";
import { limitar } from "@/server/rate-limit";
import { POST as callbackPost } from "../callback/route";

/**
 * Aprobación KYC del driver simulado: construye el callback FIRMADO y lo
 * entrega al MISMO endpoint que usaría el proveedor real (lista negra
 * incluida). Solo existe con KYC_DRIVER=simulado — igual que /api/pagos/simular.
 */
const Cuerpo = z.object({ checkId: z.string().min(4).max(100) });

export async function POST(req: Request) {
  const excedido = limitar(req, "kyc-simular", 10);
  if (excedido) return excedido;
  if ((process.env.KYC_DRIVER ?? "simulado") !== "simulado") {
    return NextResponse.json({ error: "Solo disponible con KYC simulado" }, { status: 404 });
  }
  const parseado = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parseado.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const cuerpo = JSON.stringify({
    checkId: parseado.data.checkId,
    aprobado: true,
    biometriaProveedorId: `sim-bio-${parseado.data.checkId}`,
  });
  const peticion = new Request("http://interno/api/kyc/callback", {
    method: "POST",
    headers: { "x-firma-kyc": hmacFirma(cuerpo, process.env.KYC_CALLBACK_SECRET ?? "dev-kyc-secret") },
    body: cuerpo,
  });
  return callbackPost(peticion);
}
