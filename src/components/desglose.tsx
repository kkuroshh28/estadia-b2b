"use client";

import { calcularSplit } from "@/lib/domain/split";
import { MoneyAnimado } from "./motion";
import { Money } from "./ui";

/**
 * Desglose en vivo del split (§4.2): "si cierras en $X, tú ganas $A y él gana $B".
 * Negociación con las cartas sobre la mesa; las cifras transicionan con spring
 * mientras se arrastra el monto propuesto.
 */
export function DesgloseSplit({
  precioFinal,
  tarifaNeta,
  perspectiva,
  compacto = false,
}: {
  precioFinal: number;
  tarifaNeta: number;
  perspectiva: "principal" | "externo";
  compacto?: boolean;
}) {
  const { total } = calcularSplit(precioFinal, tarifaNeta);
  const tuyo = perspectiva === "principal" ? total.principal : total.externo;
  const suyo = perspectiva === "principal" ? total.externo : total.principal;

  const filas = [
    { k: "Comisión total", v: total.comision, c: "text-tinta" },
    { k: `Tú ganas (${perspectiva === "principal" ? "50%" : "40%"})`, v: tuyo, c: "text-oro font-bold" },
    { k: `Él gana (${perspectiva === "principal" ? "40%" : "50%"})`, v: suyo, c: "text-bruma" },
    { k: "Plataforma (10%)", v: total.app, c: "text-bruma-osc" },
  ];

  return (
    <div className={`rounded-xl border border-oro/20 bg-oro-tenue/40 ${compacto ? "p-3" : "p-4"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-oro">
        Si cierras en <MoneyAnimado valor={precioFinal} />
      </p>
      <div className={`mt-2 space-y-1 ${compacto ? "text-xs" : "text-sm"}`}>
        {filas.map((f) => (
          <div key={f.k} className="flex items-center justify-between gap-4">
            <span className="text-bruma">{f.k}</span>
            <MoneyAnimado valor={f.v} className={f.c} />
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-oro/15 pt-2 text-[11px] text-bruma-osc">
        El propietario recibe su tarifa neta <Money valor={tarifaNeta} /> completa
        (−3% pasarela). La comisión va por encima, nunca sale de ella.
      </p>
    </div>
  );
}
