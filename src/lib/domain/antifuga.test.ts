import { describe, expect, it } from "vitest";
import { filtrarMensaje } from "./antifuga";

describe("anti-fuga — bloquea", () => {
  const casos: [string, string][] = [
    ["mi número es 310 555 1234", "celular con espacios"],
    ["3105551234", "celular contiguo"],
    ["3-1-0-5-5-5-1-2-3-4", "ofuscado con guiones"],
    ["tres uno cero cinco cinco cinco uno dos tres cuatro", "escrito en palabras"],
    ["tres10 555 12 34", "mixto palabras y dígitos"],
    ["escríbeme a juan.perez@gmail.com", "correo"],
    ["hablemos por whatsapp", "canal externo"],
    ["por wsp mejor", "wsp abreviado"],
    ["mi insta es @juanp_ventas", "usuario de red"],
    ["wa.me/573105551234", "URL de contacto"],
    ["llámame y cuadramos", "solicitud de contacto"],
    ["te paso el dato y hablamos", "solicitud de contacto"],
  ];
  for (const [texto, caso] of casos) {
    it(caso, () => {
      expect(filtrarMensaje(texto).bloqueado, `debería bloquear: "${texto}"`).toBe(true);
    });
  }
});

describe("anti-fuga — permite (cero falsos positivos operativos)", () => {
  const casos: [string, string][] = [
    ["¿Cerramos en $5.100.000?", "precio en COP"],
    ["la tarifa neta es $1.450.000 por noche", "tarifa con formato es-CO"],
    ["el cliente confirma 3 noches para 12 personas", "números operativos cortos"],
    ["acepto en el módulo y sale el link", "mensaje normal"],
    ["llegan el 17 de julio a las 3 pm", "fechas y horas"],
    ["son 2 adultos y 2 niños, capacidad ok", "conteos"],
    ["quedó en $12.345.678 el total del mes", "monto grande con miles"],
  ];
  for (const [texto, caso] of casos) {
    it(caso, () => {
      const r = filtrarMensaje(texto);
      expect(r.bloqueado, `no debería bloquear: "${texto}" (motivos: ${r.motivos})`).toBe(false);
    });
  }
});
