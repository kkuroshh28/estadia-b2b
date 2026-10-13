"use client";

import dynamic from "next/dynamic";

/**
 * Gráficas con Recharts FUERA del render inicial: se cargan solo en el cliente
 * (ssr:false) tras hidratar, con un skeleton del mismo alto mientras llega el
 * chunk. Así el HTML y el JS inicial del panel no cargan Recharts.
 * (ssr:false solo se permite desde un componente cliente → por eso este wrapper.)
 */
export const GraficaIngresosDiferida = dynamic(
  () => import("./grafica-ingresos").then((m) => m.GraficaIngresos),
  { ssr: false, loading: () => <div className="esqueleto h-52" aria-hidden /> },
);

export const GraficaComisionesDiferida = dynamic(
  () => import("./grafica-comisiones").then((m) => m.GraficaComisiones),
  { ssr: false, loading: () => <div className="esqueleto h-full" aria-hidden /> },
);
