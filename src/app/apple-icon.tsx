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
          background: "#101b16",
        }}
      >
        <svg width="129" height="129" viewBox="0 0 100 100" fill="none">
          <path
            d="M 72.9 17.2 A 40 40 0 1 0 72.9 82.8 A 37.6 37.6 0 1 1 72.9 17.2 Z"
            fill="#c9a46b"
          />
        </svg>
      </div>
    ),
    size,
  );
}
