import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://estadia-b2b.vercel.app"),
  title: {
    default: "ESTADÍA — La red B2B de rentas cortas de Antioquia",
    template: "%s · ESTADÍA",
  },
  description:
    "Plataforma B2B que conecta propietarios de inmuebles de renta corta con su red de comisionistas. El calendario solo se bloquea con dinero. El primero que paga, gana.",
  openGraph: {
    title: "ESTADÍA — La red B2B de rentas cortas de Antioquia",
    description:
      "La app no te quita tu cliente: te da inventario. Split automático 50/40/10, calendario que nunca miente y pago garantizado por link.",
    url: "https://estadia-b2b.vercel.app",
    siteName: "ESTADÍA",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  applicationName: "ESTADÍA",
  appleWebApp: { capable: true, title: "ESTADÍA", statusBarStyle: "black-translucent" },
};

export const viewport = {
  themeColor: "#81d8d0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} ${bricolage.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
