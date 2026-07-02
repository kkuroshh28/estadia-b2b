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
          background: "linear-gradient(160deg, #0abab5 0%, #089e9a 100%)",
          color: "#ffffff",
          fontSize: 300,
          fontWeight: 700,
        }}
      >
        E<span style={{ color: "#0f3d3b" }}>.</span>
      </div>
    ),
    size,
  );
}
