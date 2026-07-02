import { describe, expect, it } from "vitest";
import {
  centavos,
  DineroInvalidoError,
  formatear,
  liquidarReserva,
  pesosACentavos,
  porcentajeBps,
  repartirComision,
  restar,
  sumar,
} from "./index";

describe("centavos", () => {
  it("rechaza flotantes", () => {
    expect(() => centavos(100.5)).toThrow(DineroInvalidoError);
    expect(() => centavos(0.1 + 0.2)).toThrow(DineroInvalidoError);
  });
  it("rechaza no-enteros-seguros", () => {
    expect(() => centavos(Number.MAX_SAFE_INTEGER + 1)).toThrow(DineroInvalidoError);
    expect(() => centavos(NaN)).toThrow(DineroInvalidoError);
    expect(() => centavos(Infinity)).toThrow(DineroInvalidoError);
  });
  it("convierte pesos con decimales de input a centavos exactos", () => {
    expect(pesosACentavos(1_000_000)).toBe(100_000_000);
    expect(pesosACentavos(0.1)).toBe(10);
  });
});

describe("formatear (Intl es-CO)", () => {
  it("formatea centavos como COP sin decimales", () => {
    const s = formatear(centavos(120_000_000)); // $1.200.000
    expect(s).toContain("1.200.000");
    expect(s).toMatch(/\$/);
  });
});

describe("repartirComision — suma EXACTA siempre", () => {
  it("caso del ejemplo de la spec: comisión $200.000", () => {
    const s = repartirComision(centavos(20_000_000));
    expect(s.principal).toBe(10_000_000); // $100.000
    expect(s.externo).toBe(8_000_000); // $80.000
    expect(s.app).toBe(2_000_000); // $20.000
  });

  it("invariante de suma exacta sobre 10.000 montos arbitrarios", () => {
    for (let i = 0; i < 10_000; i++) {
      // montos primos/impares/pequeños que fuerzan residuos de redondeo
      const comision = centavos(i * 7 + (i % 13) + 1);
      const s = repartirComision(comision);
      expect(s.principal + s.externo + s.app).toBe(comision);
      expect(s.principal).toBeGreaterThanOrEqual(0);
      expect(s.externo).toBeGreaterThanOrEqual(0);
      expect(s.app).toBeGreaterThanOrEqual(0);
    }
  });

  it("el residuo va a la plataforma (política explícita)", () => {
    // comisión de 101 centavos: 50% = 50.5 → 50; 40% = 40.4 → 40; app = 11
    const s = repartirComision(centavos(101));
    expect(s.principal).toBe(50);
    expect(s.externo).toBe(40);
    expect(s.app).toBe(11);
  });

  it("rechaza comisión negativa", () => {
    expect(() => repartirComision(centavos(-1))).toThrow(DineroInvalidoError);
  });
});

describe("liquidarReserva — invariantes financieros completos", () => {
  it("caso spec: $1.200.000 sobre neta $1.000.000", () => {
    const liq = liquidarReserva(pesosACentavos(1_200_000), pesosACentavos(1_000_000));
    expect(liq.comisionTotal).toBe(20_000_000);
    const [m1, m2] = liq.mitades;
    expect(m1.montoCliente).toBe(60_000_000);
    expect(m2.montoCliente).toBe(60_000_000);
    expect(m1.split.principal + m2.split.principal).toBe(10_000_000);
    expect(m1.split.externo + m2.split.externo).toBe(8_000_000);
    expect(m1.split.app + m2.split.app).toBe(2_000_000);
    // pasarela 3% de cada mitad de $600.000 = $18.000
    expect(m1.pasarela).toBe(1_800_000);
    expect(m1.propietarioNeto).toBe(48_200_000); // $482.000
  });

  it("invariantes sobre 5.000 combinaciones con montos impares", () => {
    for (let i = 1; i < 5_000; i++) {
      const neta = centavos(i * 137 + 3); // impar a propósito
      const precio = centavos(neta + i * 41 + 1);
      const liq = liquidarReserva(precio, neta);
      const [m1, m2] = liq.mitades;
      // Las mitades reconstruyen los totales EXACTOS
      expect(m1.montoCliente + m2.montoCliente).toBe(precio);
      expect(m1.tarifaNeta + m2.tarifaNeta).toBe(neta);
      // Cada mitad cuadra internamente
      expect(m1.tarifaNeta + m1.split.comision).toBe(m1.montoCliente);
      expect(m2.tarifaNeta + m2.split.comision).toBe(m2.montoCliente);
      // Cada split cuadra
      expect(m1.split.principal + m1.split.externo + m1.split.app).toBe(m1.split.comision);
      expect(m2.split.principal + m2.split.externo + m2.split.app).toBe(m2.split.comision);
      // La comisión total se conserva entre mitades
      expect(m1.split.comision + m2.split.comision).toBe(liq.comisionTotal);
    }
  });

  it("rechaza precio inferior a la tarifa neta", () => {
    expect(() => liquidarReserva(centavos(100), centavos(200))).toThrow(DineroInvalidoError);
  });

  it("porcentajeBps es determinista y entero", () => {
    expect(porcentajeBps(centavos(100_000_000), 300)).toBe(3_000_000);
    expect(porcentajeBps(centavos(1), 300)).toBe(0);
    expect(porcentajeBps(centavos(167), 300)).toBe(5); // 5.01 → 5
  });

  it("sumar/restar validan enteros", () => {
    expect(sumar(centavos(1), centavos(2), centavos(3))).toBe(6);
    expect(restar(centavos(10), centavos(4))).toBe(6);
  });
});
