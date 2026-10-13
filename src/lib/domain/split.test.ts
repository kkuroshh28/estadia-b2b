import { describe, expect, it } from "vitest";
import { calcularSplit } from "./split";
import { liquidarReserva, pesosACentavos } from "@/lib/dinero";

/** M8: el desglose de la UI debe coincidir EXACTO con lo que liquida el servidor. */
describe("calcularSplit — mismo motor que el servidor", () => {
  it("mitad y total coinciden al centavo con liquidarReserva (precios impares)", () => {
    for (const [precio, neta] of [
      [1_200_000, 1_000_000],
      [1_200_001, 1_000_000],
      [987_653, 512_347],
      [5_100_001, 4_350_000],
    ]) {
      const ui = calcularSplit(precio, neta);
      const liq = liquidarReserva(pesosACentavos(precio), pesosACentavos(neta));
      const [m1, m2] = liq.mitades;
      expect(ui.porMitad.precioFinal * 100).toBe(m1.montoCliente);
      expect(ui.porMitad.principal * 100).toBeCloseTo(m1.split.principal, 6);
      expect(ui.porMitad.externo * 100).toBeCloseTo(m1.split.externo, 6);
      expect(ui.porMitad.app * 100).toBeCloseTo(m1.split.app, 6);
      expect(Math.round(ui.total.principal * 100)).toBe(m1.split.principal + m2.split.principal);
      expect(Math.round(ui.total.externo * 100)).toBe(m1.split.externo + m2.split.externo);
      expect(Math.round(ui.total.app * 100)).toBe(m1.split.app + m2.split.app);
      expect(Math.round(ui.total.precioFinal * 100)).toBe(pesosACentavos(precio));
      expect(Math.round(ui.total.comision * 100)).toBe(liq.comisionTotal);
    }
  });

  it("precio por debajo de la neta (input a medio digitar) no lanza: comisión 0", () => {
    const ui = calcularSplit(500_000, 1_000_000);
    expect(ui.total.comision).toBe(0);
    expect(ui.porMitad.principal).toBe(0);
  });
});
