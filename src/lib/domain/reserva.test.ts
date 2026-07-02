import { describe, expect, it } from "vitest";
import {
  calendarioBloqueado,
  entregaAutorizada,
  ESTADOS_TERMINALES,
  puedeTransicionar,
  TRANSICIONES,
} from "./reserva";
import type { EstadoReserva } from "./tipos";

const TODOS = Object.keys(TRANSICIONES) as EstadoReserva[];

describe("máquina de estados — TODAS las transiciones", () => {
  it("cada transición declarada es válida y toda no-declarada es inválida", () => {
    for (const desde of TODOS) {
      for (const hacia of TODOS) {
        const declarada = TRANSICIONES[desde].includes(hacia);
        expect(
          puedeTransicionar(desde, hacia),
          `${desde} → ${hacia} debería ser ${declarada ? "válida" : "inválida"}`,
        ).toBe(declarada);
      }
    }
  });

  it("el camino feliz completo es transitable de punta a punta", () => {
    const camino: EstadoReserva[] = [
      "SOLICITADA", "ACEPTADA", "NEGOCIACION", "PRECIO_ACORDADO",
      "LINK_1_ENVIADO", "ANTICIPO_PAGADO", "SALDO_LINK_ENVIADO",
      "PAGO_COMPLETO", "CHECK_IN", "COMPLETADA",
    ];
    for (let i = 0; i < camino.length - 1; i++) {
      expect(puedeTransicionar(camino[i], camino[i + 1])).toBe(true);
    }
  });

  it("los estados terminales no tienen salida", () => {
    for (const t of ESTADOS_TERMINALES) {
      expect(TRANSICIONES[t]).toHaveLength(0);
    }
  });

  it("no se puede saltar al pago sin pasar por la negociación", () => {
    expect(puedeTransicionar("SOLICITADA", "ANTICIPO_PAGADO")).toBe(false);
    expect(puedeTransicionar("ACEPTADA", "LINK_1_ENVIADO")).toBe(false);
    expect(puedeTransicionar("NEGOCIACION", "PAGO_COMPLETO")).toBe(false);
  });

  it("INVALIDADA solo puede ocurrir con link enviado (carrera de pagos)", () => {
    for (const desde of TODOS) {
      if (puedeTransicionar(desde, "INVALIDADA")) {
        expect(desde).toBe("LINK_1_ENVIADO");
      }
    }
  });

  it("sin pago completo NO hay entrega; el calendario solo bloquea con dinero", () => {
    expect(entregaAutorizada("SALDO_LINK_ENVIADO")).toBe(false);
    expect(entregaAutorizada("PAGO_COMPLETO")).toBe(true);
    expect(calendarioBloqueado("LINK_1_ENVIADO")).toBe(false); // sin holds
    expect(calendarioBloqueado("ANTICIPO_PAGADO")).toBe(true); // Pago 1 = bloqueo
  });
});
