/**
 * Adaptador OCR para imágenes del chat. Driver por env OCR_DRIVER:
 * "simulado" (default — trata los bytes como texto UTF-8: suficiente para
 * tests y desarrollo) | "tesseract" (local, real).
 */
export interface AdaptadorOcr {
  extraerTexto(imagen: Buffer): Promise<string>;
}

const simulado: AdaptadorOcr = {
  async extraerTexto(imagen) {
    return imagen.toString("utf8");
  },
};

const tesseract: AdaptadorOcr = {
  async extraerTexto(imagen) {
    // Import dinámico con especificador variable: tesseract.js es dependencia
    // OPCIONAL (solo se instala si se activa este driver) y el bundler no debe
    // intentar resolverla en build.
    const nombreModulo = ["tesseract", "js"].join(".");
    const mod = (await import(nombreModulo).catch(() => null)) as
      | { recognize: (i: Buffer, lang: string) => Promise<{ data: { text: string } }> }
      | null;
    if (!mod) {
      throw new Error("OCR tesseract: instalar con `npm i tesseract.js` (ver docs/credenciales-necesarias.md)");
    }
    const r = await mod.recognize(imagen, "spa");
    return r.data.text;
  },
};

export function obtenerOcr(): AdaptadorOcr {
  return (process.env.OCR_DRIVER ?? "simulado") === "tesseract" ? tesseract : simulado;
}
