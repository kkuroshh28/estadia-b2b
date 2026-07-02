import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "#0abab5",
          color: "#ffffff",
          fontSize: 104,
          fontWeight: 700,
        }}
      >
        E<span style={{ color: "#0f3d3b" }}>.</span>
      </div>
    ),
    size,
  );
}
