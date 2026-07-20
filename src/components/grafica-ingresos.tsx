"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatearCOP } from "@/lib/domain/split";

const NETO_MENSUAL = [
  { mes: "Feb", neto: 4_820_000 },
  { mes: "Mar", neto: 6_940_000 },
  { mes: "Abr", neto: 5_610_000 },
  { mes: "May", neto: 9_230_000 },
  { mes: "Jun", neto: 10_480_000 },
  { mes: "Jul", neto: 8_960_000 },
];

/** Neto mensual del propietario — dispersión directa, tarifa neta completa. */
export function GraficaIngresos({ datos = NETO_MENSUAL }: { datos?: { mes: string; neto: number }[] }) {
  if (datos.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-bruma">
        Tus primeros netos dispersados dibujarán esta gráfica.
      </div>
    );
  }
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="netoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-esmeralda)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-esmeralda)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" stroke="var(--color-bruma-osc)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="var(--color-bruma-osc)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${Math.round((v / 1_000_000) * 10) / 10}M`}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-borde-claro)" }}
            contentStyle={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-borde-claro)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-bruma)" }}
            formatter={(v) => [formatearCOP(Number(v)), "Neto recibido"]}
          />
          <Area
            type="monotone"
            dataKey="neto"
            stroke="var(--color-esmeralda)"
            strokeWidth={2}
            fill="url(#netoGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
