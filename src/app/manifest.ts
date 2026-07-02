import type { MetadataRoute } from "next";

/** PWA instalable — el gremio trabaja desde el celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ESTADÍA — Red B2B de rentas cortas",
    short_name: "ESTADÍA",
    description:
      "La red B2B de rentas cortas de Antioquia. El primero que paga, gana.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f7fafa",
    theme_color: "#0abab5",
    lang: "es-CO",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
