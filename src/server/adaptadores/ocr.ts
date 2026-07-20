/**
 * Adaptador OCR para imágenes del chat. Driver por env OCR_DRIVER:
 * "simulado" (default — trata los bytes como texto UTF-8: suficiente para
 * tests y desarrollo) | "tesseract" (real, local; tesseract.js ya está en
 * package.json — activar es solo OCR_DRIVER=tesseract).
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
    // Import dinámico con especificador variable: el bundler de Next no debe
    // resolverla en build (el worker WASM solo se carga si el driver está activo).
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
