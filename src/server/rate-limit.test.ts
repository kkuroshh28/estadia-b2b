import { describe, expect, it } from "vitest";
import { permitirPeticion } from "./rate-limit";

describe("rate limit — ventana deslizante", () => {
  it("permite hasta el máximo y bloquea el excedente", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(permitirPeticion("t1:ip", 5, t0 + i)).toBe(true);
    }
    expect(permitirPeticion("t1:ip", 5, t0 + 10)).toBe(false);
  });

  it("libera cupo cuando la ventana desliza", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 3; i++) permitirPeticion("t2:ip", 3, t0 + i);
    expect(permitirPeticion("t2:ip", 3, t0 + 100)).toBe(false);
    // 61 s después, las marcas viejas expiran.
    expect(permitirPeticion("t2:ip", 3, t0 + 61_000)).toBe(true);
  });

  it("las claves son independientes (por IP y por ruta)", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 3; i++) permitirPeticion("t3:ip-a", 3, t0 + i);
    expect(permitirPeticion("t3:ip-a", 3, t0 + 10)).toBe(false);
    expect(permitirPeticion("t3:ip-b", 3, t0 + 10)).toBe(true);
    expect(permitirPeticion("otra-ruta:ip-a", 3, t0 + 10)).toBe(true);
  });
});
