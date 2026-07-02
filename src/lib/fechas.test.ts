import { describe, expect, it } from "vitest";
import { formatearFechaCO, hoyEnBogota } from "./fechas";
import { nochesEntre, validarDuracion } from "./domain/reglas";

describe("fechas America/Bogota — sin off-by-one", () => {
  it("una fecha-calendario NUNCA se corre un día (el bug clásico de UTC)", () => {
    // El anti-patrón new Date("2026-07-17") en Bogotá mostraría "16 jul".
    expect(formatearFechaCO("2026-07-17")).toMatch(/17/);
    expect(formatearFechaCO("2026-01-01")).toMatch(/1/);
    expect(formatearFechaCO("2026-12-31")).toMatch(/31/);
  });

  it("formatea en es-CO", () => {
    const s = formatearFechaCO("2026-07-17", { day: "numeric", month: "long", year: "numeric" });
    expect(s.toLowerCase()).toContain("julio");
    expect(s).toContain("2026");
  });

  it("hoyEnBogota devuelve el día correcto aun cuando UTC ya cambió de día", () => {
    // 2026-07-18 03:30 UTC = 2026-07-17 22:30 en Bogotá
    const utcMadrugada = new Date(Date.UTC(2026, 6, 18, 3, 30));
    expect(hoyEnBogota(utcMadrugada)).toBe("2026-07-17");
    // 2026-07-18 12:00 UTC = 2026-07-18 07:00 en Bogotá
    const utcMediodia = new Date(Date.UTC(2026, 6, 18, 12, 0));
    expect(hoyEnBogota(utcMediodia)).toBe("2026-07-18");
  });
});

describe("regla #2 — duración 1 noche a 3 meses, validada en servidor", () => {
  it("acepta 1 noche y 92 noches", () => {
    expect(validarDuracion("2026-07-17", "2026-07-18").valida).toBe(true);
    expect(validarDuracion("2026-07-01", "2026-10-01").valida).toBe(true); // 92
  });
  it("rechaza 0 noches, fechas invertidas y más de 3 meses", () => {
    expect(validarDuracion("2026-07-17", "2026-07-17").valida).toBe(false);
    expect(validarDuracion("2026-07-18", "2026-07-17").valida).toBe(false);
    expect(validarDuracion("2026-07-01", "2026-10-02").valida).toBe(false); // 93
  });
  it("nochesEntre cruza meses y años sin depender de la TZ del proceso", () => {
    expect(nochesEntre("2026-12-30", "2027-01-02")).toBe(3);
    expect(nochesEntre("2026-02-27", "2026-03-02")).toBe(3); // no bisiesto
  });
});
