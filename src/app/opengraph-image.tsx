import { ImageResponse } from "next/og";

/** OG para compartir por WhatsApp — Tiffany + blanco, se ve premium en el chat. */
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
          background: "linear-gradient(150deg, #81d8d0 55%, #a7e4de 100%)",
          color: "#0f3d3b",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
            ESTADÍA<span style={{ color: "#ffffff" }}>.</span>
          </div>
          <div
            style={{
              display: "flex",
              background: "#ffffff",
              color: "#0f3d3b",
              fontSize: 22,
              fontWeight: 700,
              padding: "10px 22px",
              borderRadius: 999,
            }}
          >
            Antioquia · 100% B2B
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            La app no te quita tu cliente.
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "#ffffff" }}>
            Te da inventario.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 28, color: "#0f3d3b", opacity: 0.75 }}>
            Red B2B de rentas cortas
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#0f3d3b", fontFamily: "monospace", fontWeight: 700 }}>
            50 / 40 / 10 · el primero que paga, gana
          </div>
        </div>
      </div>
    ),
    size,
  );
}
