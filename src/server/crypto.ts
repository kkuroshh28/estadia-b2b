import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Criptografía central. En producción ENCRYPTION_KEY/HASH_PEPPER vienen de env
 * (ver .env.example); el default SOLO existe para desarrollo/tests locales.
 */
const DEV_KEY = "dev-key-no-usar-en-produccion-0000000000000000";

function claveAes(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  return hex ? Buffer.from(hex, "hex") : createHash("sha256").update(DEV_KEY).digest();
}

export function sha256Hex(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

/** Hash de cédula con pepper: identifica sin exponer (lista negra, unicidad). */
export function hashCedula(cedula: string): string {
  const pepper = process.env.HASH_PEPPER ?? DEV_KEY;
  return createHmac("sha256", pepper).update(cedula.trim()).digest("hex");
}

export function hmacFirma(cuerpo: string, secreto: string): string {
  return createHmac("sha256", secreto).update(cuerpo).digest("hex");
}

/** AES-256-GCM — cifrado en reposo de cédulas, teléfonos y cuentas bancarias. */
export function cifrar(textoPlano: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", claveAes(), iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${cifrado.toString("hex")}`;
}

export function descifrar(empaquetado: string): string {
  const [ivHex, tagHex, datosHex] = empaquetado.split(".");
  const decipher = createDecipheriv("aes-256-gcm", claveAes(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(datosHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

// ─── TOTP (RFC 6238) — 2FA obligatorio para admin, sin dependencias ─────────

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generarSecretoTotp(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32ADecodificar(s: string): Buffer {
  let bits = "";
  for (const c of s.toUpperCase().replace(/=+$/, "")) {
    const v = BASE32.indexOf(c);
    if (v === -1) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function codigoTotp(secretoBase32: string, epocaMs = Date.now()): string {
  const contador = Math.floor(epocaMs / 30_000);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const h = createHmac("sha1", base32ADecodificar(secretoBase32)).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const codigo =
    ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(codigo % 1_000_000).padStart(6, "0");
}

/** Ventana ±1 periodo (desfase de reloj del teléfono). */
export function verificarTotp(secretoBase32: string, codigo: string, epocaMs = Date.now()): boolean {
  return [-1, 0, 1].some(
    (d) => codigoTotp(secretoBase32, epocaMs + d * 30_000) === codigo.trim(),
  );
}
