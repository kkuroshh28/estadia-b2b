import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #0b0f14 0%, #0c2a1e 100%)",
          color: "#eef2f7",
          fontSize: 300,
          fontWeight: 700,
        }}
      >
        E<span style={{ color: "#2fd48a" }}>.</span>
      </div>
    ),
    size,
  );
}
