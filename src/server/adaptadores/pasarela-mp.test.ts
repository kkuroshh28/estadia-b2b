/**
 * Verificación de firma de MercadoPago — la parte PURA (manifiesto + HMAC).
 * La consulta del pago al API es integración y se valida en sandbox con llaves.
 */
import { describe, expect, it } from "vitest";
import { hmacFirma } from "../crypto";
import { manifiestoMp, obtenerPasarela, parsearFirmaMp, FirmaInvalidaError } from "./pasarela";

describe("mercadopago — firma de webhooks", () => {
  it("construye el manifiesto exacto del formato documentado", () => {
    expect(manifiestoMp("123", "req-9", "1700000000")).toBe(
      "id:123;request-id:req-9;ts:1700000000;",
    );
  });

  it("parsea el header x-signature (ts=...,v1=...)", () => {
    expect(parsearFirmaMp("ts=1700000000,v1=abc123")).toEqual({ ts: "1700000000", v1: "abc123" });
    expect(parsearFirmaMp("v1=abc123")).toBeNull();
    expect(parsearFirmaMp("")).toBeNull();
  });

  it("rechaza una notificación con firma inválida ANTES de tocar la red", async () => {
    process.env.PASARELA_DRIVER = "mercadopago";
    process.env.MP_WEBHOOK_SECRET = "secreto-test";
    try {
      const mp = obtenerPasarela();
      const cuerpo = JSON.stringify({ data: { id: "999" } });
      await expect(
        Promise.resolve(
          mp.verificarFirma(cuerpo, "ts=1700000000,v1=firma-falsa", { "x-request-id": "r1" }),
        ),
      ).rejects.toThrow(FirmaInvalidaError);
    } finally {
      delete process.env.PASARELA_DRIVER;
      delete process.env.MP_WEBHOOK_SECRET;
    }
  });

  it("acepta el HMAC correcto del manifiesto (falla después SOLO por la consulta al API)", async () => {
    process.env.PASARELA_DRIVER = "mercadopago";
    process.env.MP_WEBHOOK_SECRET = "secreto-test";
    try {
      const mp = obtenerPasarela();
      const cuerpo = JSON.stringify({ data: { id: "999" } });
      const v1 = hmacFirma(manifiestoMp("999", "r1", "1700000000"), "secreto-test");
      // Sin MP_ACCESS_TOKEN la consulta del pago falla — pero NO por firma:
      // eso demuestra que el HMAC pasó.
      await expect(
        Promise.resolve(
          mp.verificarFirma(cuerpo, `ts=1700000000,v1=${v1}`, { "x-request-id": "r1" }),
        ),
      ).rejects.toThrow(/consulta de pago|fetch/i);
    } finally {
      delete process.env.PASARELA_DRIVER;
      delete process.env.MP_WEBHOOK_SECRET;
    }
  });
});
