"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, Stat } from "@/components/ui";
import { MoneyAnimado } from "@/components/motion";
import { FlujoDinero } from "@/components/flujo-dinero";
import { formatearCOP } from "@/lib/domain/split";
import type { DatosComisiones } from "@/lib/domain/paneles";

/** Panel "Mis comisiones" compartido entre Principal (50%) y Externo (40%). */
export function PanelComisiones({ rol, datos }: { rol: "principal" | "externo"; datos: DatosComisiones }) {
  const alias = datos.alias ?? "—";
  const pct = rol === "principal" ? "50%" : "40%";
  const totalAno = datos.porMes.reduce((a, m) => a + m.monto, 0);
  const esteMes = datos.porMes.length ? datos.porMes[datos.porMes.length - 1].monto : 0;
  const promedio = datos.reservasCompletadas > 0 ? Math.round(totalAno / datos.reservasCompletadas) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-tinta">Mis comisiones</h1>
        <p className="mt-1 text-sm text-bruma">
          <span className="font-mono text-oro">{alias}</span> · recibes el {pct} de la
          comisión de cada mitad, dispersado automático a tu cuenta certificada.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat etiqueta="Acumulado 2026" valor={<MoneyAnimado valor={totalAno} />} detalle="Total liquidado en la red" tono="esmeralda" />
        <Stat etiqueta="Mes en curso" valor={<MoneyAnimado valor={esteMes} />} detalle="Crece con cada split confirmado" tono="oro" />
        <Stat etiqueta="Promedio por reserva" valor={<MoneyAnimado valor={promedio} />} detalle={`${datos.reservasCompletadas} reservas completadas`} />
      </div>

      {/* GRÁFICA */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-tinta">Comisiones por mes</h2>
          <Badge tono="esmeralda">Dispersión directa · sin retenciones</Badge>
        </div>
        <div className="mt-5 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos.porMes} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
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
        </div>
      </Card>

      {/* HISTORIAL DE SPLITS */}
      <Card className="overflow-hidden">
        <div className="border-b border-borde px-6 py-4">
          <h2 className="font-display text-xl text-tinta">Historial de splits</h2>
          <p className="text-xs text-bruma">Cada mitad confirmada por webhook genera su liquidación inmediata. Exportable.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-bruma-osc">
                <th className="px-6 py-3">Fecha</th>
                <th className="px-4 py-3">Reserva</th>
                <th className="px-4 py-3">Propiedad</th>
                <th className="px-4 py-3">Mitad</th>
                <th className="px-4 py-3 text-right">Comisión total</th>
                <th className="px-4 py-3 text-right">Tu parte ({pct})</th>
                <th className="px-6 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {datos.splits.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-xs text-bruma">
                    Tus liquidaciones aparecerán aquí con cada pago confirmado.
                  </td>
                </tr>
              )}
              {datos.splits.map((s) => (
                <tr key={`${s.codigo}-${s.mitad}`} className="text-bruma transition hover:bg-tarjeta-alta">
                  <td className="cifra px-6 py-3 text-xs">{s.fecha}</td>
                  <td className="cifra px-4 py-3 text-xs text-bruma-osc">{s.codigo}</td>
                  <td className="px-4 py-3 text-tinta">{s.propiedad}</td>
                  <td className="cifra px-4 py-3 text-xs">{s.mitad}/2</td>
                  <td className="cifra px-4 py-3 text-right">{formatearCOP(s.comisionTotal)}</td>
                  <td className="cifra px-4 py-3 text-right font-bold text-esmeralda">
                    {formatearCOP(rol === "principal" ? s.principal : s.externo)}
                  </td>
                  <td className="px-6 py-3">
                    {s.dispersado ? (
                      <Badge tono="esmeralda">Dispersado</Badge>
                    ) : (
                      <Badge tono="oro">En dispersión</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {datos.esDemo && (
        <FlujoDinero
          precioFinal={2_280_000}
          tarifaNeta={1_960_000}
          titulo="Tu última liquidación · CIR-2026-00341 · mitad 2"
        />
      )}
    </div>
  );
}
