import { ImageResponse } from "next/og";

/** OG para compartir por WhatsApp — Tiffany + blanco, se ve premium en el chat. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "THE CIRCLE — La red B2B de rentas cortas de Antioquia";

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
          background: "linear-gradient(150deg, #0c1511 55%, #16241d 100%)",
          color: "#f1ebdd",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 44, fontWeight: 700, color: "#c9a46b" }}>
            <svg width="64" height="64" viewBox="0 0 100 100" fill="none">
              <path d="M 72.9 17.2 A 40 40 0 1 0 72.9 82.8 A 37.6 37.6 0 1 1 72.9 17.2 Z" fill="#c9a46b" />
            </svg>
            THE CIRCLE
          </div>
          <div
            style={{
              display: "flex",
              background: "#ffffff",
              color: "#f1ebdd",
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
          <div style={{ display: "flex", fontSize: 28, color: "#f1ebdd", opacity: 0.75 }}>
            Red B2B de rentas cortas
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#f1ebdd", fontFamily: "monospace", fontWeight: 700 }}>
            45 / 45 / 10 · el primero que paga, gana
          </div>
        </div>
      </div>
    ),
    size,
  );
}
