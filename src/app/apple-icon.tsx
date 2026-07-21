import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** El anillo de THE CIRCLE sobre fondo Tiffany plano (iOS redondea solo). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#81d8d0",
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: "50%",
            border: "20px solid #0f3d3b",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 28,
            bottom: 30,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#ffffff",
            display: "flex",
          }}
        />
      </div>
    ),
    size,
  );
}
