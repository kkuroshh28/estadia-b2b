import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** El anillo de THE CIRCLE: círculo de tinta sobre el degradado Tiffany. */
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
          background: "#101b16",
        }}
      >
        <svg width="368" height="368" viewBox="0 0 100 100" fill="none">
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
