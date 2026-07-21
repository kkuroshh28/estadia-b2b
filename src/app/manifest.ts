import type { MetadataRoute } from "next";

/** PWA instalable — el gremio trabaja desde el celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "THE CIRCLE — Red B2B de rentas cortas",
    short_name: "THE CIRCLE",
    description:
      "La red B2B de rentas cortas de Antioquia. El primero que paga, gana.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f7fafa",
    theme_color: "#81d8d0",
    lang: "es-CO",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
