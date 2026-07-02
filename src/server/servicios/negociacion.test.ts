import { describe, expect, it } from "vitest";
import { validarPropuestaServidor } from "./negociacion";
import { centavos } from "@/lib/dinero";

const NETA = centavos(435_000_000); // $4.350.000

describe("regla #8 — piso de comisión programado, apagado al lanzamiento", () => {
  it("APAGADO: cualquier precio ≥ tarifa neta es válido (prioridad: volumen)", () => {
    const piso = { activo: false, pct: 0.08 };
    expect(validarPropuestaServidor(NETA, NETA, piso).valida).toBe(true);
    expect(validarPropuestaServidor(centavos(NETA + 1), NETA, piso).valida).toBe(true);
  });

  it("ENCENDIDO: rechaza ofertas bajo neta + pct y acepta desde el mínimo", () => {
    const piso = { activo: true, pct: 0.08 };
    const minimo = centavos(NETA + Math.ceil(NETA * 0.08));
    expect(validarPropuestaServidor(centavos(minimo - 1), NETA, piso).valida).toBe(false);
    expect(validarPropuestaServidor(minimo, NETA, piso).valida).toBe(true);
    expect(validarPropuestaServidor(centavos(minimo - 1), NETA, piso).motivo).toContain("Piso");
  });

  it("SIEMPRE: nunca por debajo de la tarifa neta (regla #5), con o sin piso", () => {
    for (const activo of [true, false]) {
      const r = validarPropuestaServidor(centavos(NETA - 1), NETA, { activo, pct: 0.08 });
      expect(r.valida).toBe(false);
      expect(r.motivo).toContain("tarifa neta");
    }
  });
});
