"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatearCOP } from "@/lib/domain/split";

/**
 * Comisiones por mes (barras). Se carga diferida (ver graficas-diferidas.tsx):
 * Recharts no entra en el bundle inicial del panel.
 */
export function GraficaComisiones({ datos }: { datos: { mes: string; monto: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={datos} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="mes" stroke="var(--color-bruma-osc)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--color-bruma-osc)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${Math.round(v / 1_000_000 * 10) / 10}M`}
          width={34}
        />
        <Tooltip
          cursor={{ fill: "var(--color-tarjeta-alta)" }}
          contentStyle={{
            background: "var(--color-panel)",
            border: "1px solid var(--color-borde-claro)",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-bruma)" }}
          formatter={(v) => [formatearCOP(Number(v)), "Comisión"]}
        />
        <Bar dataKey="monto" radius={[6, 6, 0, 0]} fill="var(--color-tiffany)" opacity={0.9} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}
