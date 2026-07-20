import { createHash } from "node:crypto";
import { hmacFirma, tokenAleatorio } from "../crypto";
import type { EventoPago } from "../servicios/pagos";

/**
 * Adaptador de pasarela. Driver por env PASARELA_DRIVER: "simulado" (default —
 * dispara el MISMO webhook interno con la MISMA firma/idempotencia que la real)
 * | "wompi" | "mercadopago" (sandbox/prod; requieren sus llaves — se encienden
 * sin tocar código).
 *
 * REGLA: si la pasarela no soporta la dispersión multi-beneficiario como exige
 * la spec, NO se improvisa — ver docs/decision-pasarela.md. Por eso dispersar()
 * lanza en ambos drivers reales hasta validarlo en sandbox.
 */
export class FirmaInvalidaError extends Error {}

export interface PasarelaPagos {
  nombre: string;
  crearLink(montoCentavos: number, referencia: string): Promise<{ url: string; ref: string }>;
  /**
   * Verifica la firma del webhook y devuelve el evento tipado. Lanza si
   * inválida. Puede ser async (MercadoPago exige consultar el pago) y puede
   * necesitar encabezados adicionales (x-request-id, x-signature).
   */
  verificarFirma(
    cuerpoCrudo: string,
    firma: string,
    encabezados?: Record<string, string | null>,
  ): EventoPago | Promise<EventoPago>;
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

// ─── MercadoPago (plan B — split/Marketplace) ────────────────────────────────

const URL_MP = "https://api.mercadopago.com";

/**
 * Manifiesto que firma MercadoPago en cada notificación:
 * id:[data.id];request-id:[x-request-id];ts:[ts];  con HMAC-SHA256 del secreto.
 * https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/webhooks
 */
export function manifiestoMp(dataId: string, requestId: string, ts: string): string {
  return `id:${dataId};request-id:${requestId};ts:${ts};`;
}

/** Parsea el header x-signature de MP ("ts=...,v1=..."). */
export function parsearFirmaMp(header: string): { ts: string; v1: string } | null {
  const partes = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=", 2) as [string, string]),
  );
  return partes.ts && partes.v1 ? { ts: partes.ts, v1: partes.v1 } : null;
}

/** Checkout Pro (preferences) — listo para MP_ACCESS_TOKEN de sandbox. */
const mercadopago: PasarelaPagos = {
  nombre: "mercadopago",
  async crearLink(montoCentavos, referencia) {
    const res = await fetch(`${URL_MP}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: `Reserva ESTADÍA ${referencia}`,
            quantity: 1,
            currency_id: "COP",
            // MP trabaja en UNIDADES de moneda (pesos), no centavos.
            unit_price: montoCentavos / 100,
          },
        ],
        external_reference: referencia, // nuestra referencia = id del link en DB
        payment_methods: { installments: 1 },
      }),
    });
    if (!res.ok) throw new Error(`MP crearLink falló: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { id: string; init_point: string };
    return { url: json.init_point, ref: json.id };
  },
  async verificarFirma(cuerpoCrudo, firma, encabezados) {
    // 1 · Validar el HMAC del manifiesto (ts + request-id + data.id).
    const secreto = process.env.MP_WEBHOOK_SECRET ?? "";
    const partes = parsearFirmaMp(firma);
    const requestId = encabezados?.["x-request-id"] ?? "";
    const cuerpo = JSON.parse(cuerpoCrudo) as { data?: { id?: string } };
    const dataId = String(cuerpo.data?.id ?? "");
    if (!partes || !secreto || !dataId) {
      throw new FirmaInvalidaError("Notificación MP sin firma/secreto/data.id.");
    }
    const esperado = hmacFirma(manifiestoMp(dataId, requestId ?? "", partes.ts), secreto);
    if (esperado !== partes.v1) {
      throw new FirmaInvalidaError("Firma x-signature de MercadoPago inválida.");
    }
    // 2 · La notificación solo trae el id: el estado REAL se consulta al API.
    const res = await fetch(`${URL_MP}/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    if (!res.ok) throw new Error(`MP consulta de pago falló: ${res.status}`);
    const pago = (await res.json()) as {
      id: number;
      status: string;
      transaction_amount: number;
      external_reference: string;
    };
    return {
      pasarelaRef: String(pago.id),
      linkId: pago.external_reference,
      montoCentavos: Math.round(pago.transaction_amount * 100),
      estado: pago.status === "approved" ? "aprobada" : "rechazada",
    };
  },
  async dispersar(cuentaBancariaId, montoCentavos, referencia) {
    // ⚠️ Igual que Wompi: la dispersión a terceros (split multi-beneficiario /
    // money transfers) depende del producto habilitado en la cuenta. NO se
    // improvisa con dinero: validar en sandbox ANTES (docs/decision-pasarela.md).
    throw new Error(
      `MP payouts sin validar (cuenta ${cuentaBancariaId}, ${montoCentavos} centavos, ref ${referencia}) — ver docs/decision-pasarela.md`,
    );
  },
  async reembolsar(pasarelaRef, montoCentavos) {
    const res = await fetch(`${URL_MP}/v1/payments/${pasarelaRef}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `refund-${pasarelaRef}-${montoCentavos}`,
      },
      body: JSON.stringify({ amount: montoCentavos / 100 }),
    });
    if (!res.ok) throw new Error(`MP reembolso falló: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { id: number };
    return { refundRef: String(json.id) };
  },
};

export function obtenerPasarela(): PasarelaPagos {
  const driver = process.env.PASARELA_DRIVER ?? "simulado";
  if (driver === "wompi") return wompi;
  if (driver === "mercadopago") return mercadopago;
  return simulado;
}
