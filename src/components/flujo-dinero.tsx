"use client";

import { motion, useReducedMotion } from "motion/react";
import { calcularSplit } from "@/lib/domain/split";
import { MoneyAnimado } from "./motion";

/**
 * Elemento de firma de la marca: el dinero del cliente fluye y se divide
 * automáticamente en sus beneficiarios. Aparece en el hero de la landing y
 * en cada pantalla de liquidación.
 */
export function FlujoDinero({
  precioFinal = 1_200_000,
  tarifaNeta = 1_000_000,
  titulo = "Así se reparte cada pago",
  activo = true,
}: {
  precioFinal?: number;
  tarifaNeta?: number;
  titulo?: string;
  activo?: boolean;
}) {
  const { total } = calcularSplit(precioFinal, tarifaNeta);
  const reducido = useReducedMotion();

  const destinos = [
    {
      k: "Propietario",
      sub: "tarifa neta completa",
      v: total.tarifaNeta,
      color: "var(--color-tiffany)",
      texto: "text-esmeralda",
      borde: "border-tiffany-claro",
    },
    {
      k: "C. Principal",
      sub: "50% de la comisión",
      v: total.principal,
      color: "var(--color-tiffany-profundo)",
      texto: "text-tinta",
      borde: "border-borde",
    },
    {
      k: "C. Externo",
      sub: "40% de la comisión",
      v: total.externo,
      color: "var(--color-tiffany-claro)",
      texto: "text-tinta",
      borde: "border-borde",
    },
    {
      k: "Plataforma",
      sub: "10% de la comisión",
      v: total.app,
      color: "var(--color-bruma)",
      texto: "text-bruma",
      borde: "border-borde",
    },
  ];

  return (
    <div className="elevada-alta rounded-2xl border border-borde bg-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bruma-osc">
          {titulo}
        </p>
        <span className="cifra text-[10px] text-bruma-osc">split automático · sin retenciones</span>
      </div>

      {/* Origen */}
      <div className="mt-5 flex justify-center">
        <div className="rounded-xl border border-borde-claro bg-tarjeta-alta px-6 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma">
            Cliente paga
          </p>
          <MoneyAnimado valor={total.precioFinal} className="text-xl font-bold text-tinta" />
        </div>
      </div>

      {/* Canales */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-4">
        {destinos.map((d, i) => (
          <div key={d.k} className="flex flex-col items-center">
            <div className="relative h-14 w-px overflow-hidden sm:h-20">
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, transparent, ${d.color}55)`,
                }}
              />
              {activo && !reducido && (
                <motion.span
                  className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full"
                  style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }}
                  animate={{ top: ["-8%", "108%"], opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.35,
                    ease: "easeIn",
                    repeatDelay: 0.4,
                  }}
                />
              )}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.5 }}
              className={`w-full rounded-xl border ${d.borde} bg-tarjeta px-3 py-3 text-center`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma">
                {d.k}
              </p>
              <MoneyAnimado valor={d.v} className={`text-sm font-bold ${d.texto}`} />
              <p className="mt-0.5 text-[9px] text-bruma-osc">{d.sub}</p>
            </motion.div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-[10px] text-bruma-osc">
        La pasarela dispersa directo a cada cuenta certificada · el propietario asume
        el ~3% (aquí <MoneyAnimado valor={total.pasarela} />)
      </p>
    </div>
  );
}
