import { ImageResponse } from "next/og";

/** OG para compartir por WhatsApp — así se comparte en este gremio. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ESTADÍA — La red B2B de rentas cortas de Antioquia";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(150deg, #0b0f14 55%, #0c2a1e 100%)",
          color: "#eef2f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
          ESTADÍA<span style={{ color: "#2fd48a" }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            La app no te quita tu cliente.
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "#2fd48a" }}>
            Te da inventario.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 28, color: "#8b9aac" }}>
            Red B2B de rentas cortas · Antioquia
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#e3a63c",
              fontFamily: "monospace",
            }}
          >
            50 / 40 / 10 · el primero que paga, gana
          </div>
        </div>
      </div>
    ),
    size,
  );
}
