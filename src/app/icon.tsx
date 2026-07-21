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
          background: "linear-gradient(160deg, #81d8d0 0%, #0abab5 100%)",
        }}
      >
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: "56px solid #0f3d3b",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 76,
            bottom: 84,
            width: 64,
            height: 64,
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
