import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad globales (nivel fintech):
 * - CSP sin orígenes externos: todo el JS/CSS/fuentes es propio (next/font).
 *   'unsafe-inline' es requisito de Next (hidratación) y de los estilos en
 *   línea de Motion/Recharts; no hay scripts de terceros que proteger.
 * - HSTS con preload, anti-clickjacking, sin sniffing de tipos.
 */
// En dev Next necesita eval() (source maps de React); en prod jamás.
const esDev = process.env.NODE_ENV === "development";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${esDev ? " ws:" : ""}`, // ws: para el HMR de dev
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
