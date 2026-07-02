import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Solo la landing es pública para buscadores; la app y los links de pago no.
      { userAgent: "*", allow: "/", disallow: ["/app", "/pago", "/api", "/registro"] },
    ],
    sitemap: "https://estadia-b2b.vercel.app/sitemap.xml",
  };
}
