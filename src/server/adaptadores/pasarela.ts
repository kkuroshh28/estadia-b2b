import { createHash } from "node:crypto";
import { hmacFirma, tokenAleatorio } from "../crypto";
import type { EventoPago } from "../servicios/pagos";

/**
 * Adaptador de pasarela. Driver por env PASARELA_DRIVER: "simulado" (default —
 * dispara el MISMO webhook interno con la MISMA firma/idempotencia que la real)
 * | "wompi" (sandbox/prod; requiere WOMPI_* — se enciende sin tocar código).
 *
 * REGLA: si Wompi no soporta la dispersión multi-beneficiario como exige la
 * spec, NO se improvisa — ver docs/decision-pasarela.md.
 */
export class FirmaInvalidaError extends Error {}

export interface PasarelaPagos {
  nombre: string;
  crearLink(montoCentavos: number, referencia: string): Promise<{ url: string; ref: string }>;
  /** Verifica la firma del webhook y devuelve el evento tipado. Lanza si inválida. */
  verificarFirma(cuerpoCrudo: string, firma: string): EventoPago;
  dispersar(cuentaBancariaId: string, montoCentavos: number, referencia: string): Promise<{ payoutRef: string }>;
  reembolsar(pasarelaRef: string, montoCentavos: number): Promise<{ refundRef: string }>;
}

function secretoWebhook(): string {
  return process.env.WEBHOOK_SECRET ?? "dev-webhook-secret";
}

/** Firma que usa el driver simulado — mismo mecanismo HMAC del mundo real. */
export function firmarEventoSimulado(cuerpo: string): string {
  return hmacFirma(cuerpo, secretoWebhook());
}

const simulado: PasarelaPagos = {
  nombre: "simulado",
  async crearLink(montoCentavos, referencia) {
    return { url: `/pago/sim/${referencia}`, ref: `sim-link-${tokenAleatorio(8)}` };
  },
  verificarFirma(cuerpoCrudo, firma) {
    if (firmarEventoSimulado(cuerpoCrudo) !== firma) {
      throw new FirmaInvalidaError("Firma de webhook inválida (simulado).");
    }
    const e = JSON.parse(cuerpoCrudo) as EventoPago;
    if (!e.pasarelaRef || !e.linkId || !Number.isSafeInteger(e.montoCentavos)) {
      throw new FirmaInvalidaError("Evento malformado.");
    }
    return e;
  },
  async dispersar(_cuenta, _monto, referencia) {
    return { payoutRef: `sim-payout-${referencia}` };
  },
  async reembolsar(pasarelaRef) {
    return { refundRef: `sim-refund-${pasarelaRef}` };
  },
};

/** Wompi sandbox (https://docs.wompi.co) — listo para llaves. */
const wompi: PasarelaPagos = {
  nombre: "wompi",
  async crearLink(montoCentavos, referencia) {
    const res = await fetch(`${urlWompi()}/payment_links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Reserva ESTADÍA ${referencia}`,
        description: "Pago de reserva de renta corta",
        single_use: true,
        currency: "COP",
        // Wompi trabaja en centavos COP — igual que nuestro módulo de dinero.
        amount_in_cents: montoCentavos,
        collect_shipping: false,
        sku: referencia,
      }),
    });
    if (!res.ok) throw new Error(`Wompi crearLink falló: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: { id: string } };
    return { url: `https://checkout.wompi.co/l/${json.data.id}`, ref: json.data.id };
  },
  verificarFirma(cuerpoCrudo, firmaRecibida) {
    // Eventos Wompi: checksum = SHA256(valores de signature.properties en orden
    // + timestamp + WOMPI_EVENTS_SECRET). https://docs.wompi.co/docs/colombia/eventos
    const evento = JSON.parse(cuerpoCrudo) as {
      timestamp: number;
      signature: { properties: string[]; checksum: string };
      data: { transaction: { id: string; status: string; amount_in_cents: number; reference: string } };
    };
    const valores = evento.signature.properties
      .map((p) => p.split(".").reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], evento.data))
      .join("");
    const esperado = createHash("sha256")
      .update(`${valores}${evento.timestamp}${process.env.WOMPI_EVENTS_SECRET ?? ""}`)
      .digest("hex");
    if (esperado !== evento.signature.checksum || esperado !== firmaRecibida) {
      throw new FirmaInvalidaError("Checksum de evento Wompi inválido.");
    }
    const t = evento.data.transaction;
    return {
      pasarelaRef: t.id,
      linkId: t.reference, // nuestra referencia = id del link en DB
      montoCentavos: t.amount_in_cents,
      estado: t.status === "APPROVED" ? "aprobada" : "rechazada",
    };
  },
  async dispersar(cuentaBancariaId, montoCentavos, referencia) {
    // ⚠️ La dispersión multi-beneficiario en Wompi depende del producto
    // "Payouts" habilitado por comercio. NO improvisar: si al probar sandbox
    // no está disponible, aplicar docs/decision-pasarela.md (MercadoPago
    // Marketplace tiene split nativo). Este método lanza hasta validarlo.
    throw new Error(
      `Wompi payouts sin validar (cuenta ${cuentaBancariaId}, ${montoCentavos} centavos, ref ${referencia}) — ver docs/decision-pasarela.md`,
    );
  },
  async reembolsar(pasarelaRef, montoCentavos) {
    const res = await fetch(`${urlWompi()}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction_id: pasarelaRef, amount_in_cents: montoCentavos }),
    });
    if (!res.ok) throw new Error(`Wompi reembolso falló: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: { id: string } };
    return { refundRef: json.data.id };
  },
};

function urlWompi(): string {
  return process.env.WOMPI_ENV === "produccion"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

export function obtenerPasarela(): PasarelaPagos {
  return (process.env.PASARELA_DRIVER ?? "simulado") === "wompi" ? wompi : simulado;
}
