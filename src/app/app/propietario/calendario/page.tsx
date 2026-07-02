"use client";

import { useMemo, useState } from "react";
import { Badge, Card, Money } from "@/components/ui";
import { PROPIEDADES } from "@/lib/data/demo";
import { calcularNetoPropietario } from "@/lib/domain/split";
import type { EstadoDia } from "@/lib/domain/tipos";

/**
 * Calendario de julio 2026 — una sola fuente de verdad de disponibilidad.
 * Solo el propietario tiene acceso de escritura (bloqueo manual).
 * Los días reservados por la app son intocables: los bloqueó el dinero.
 */

// Estados base por propiedad (derivados de reservas pagadas + sync iCal)
const BASE: Record<string, Partial<Record<number, EstadoDia>>> = {
  "prop-01": { 24: "bloqueado_ical", 25: "bloqueado_ical", 26: "bloqueado_ical" },
  "prop-02": { 10: "reservado_app", 11: "reservado_app", 12: "reservado_app", 13: "reservado_app" },
  "prop-03": { 31: "reservado_app" },
  "prop-04": {},
  "prop-05": { 3: "bloqueado_ical", 4: "bloqueado_ical" },
  "prop-06": {},
};

const BLOQUEOS_INICIALES: Record<string, number[]> = {
  "prop-01": [4, 5],
  "prop-02": [],
  "prop-03": [20],
  "prop-04": [1, 2],
  "prop-05": [],
  "prop-06": [15, 16, 17],
};

const ESTILO_DIA: Record<EstadoDia, string> = {
  disponible: "border-borde bg-tarjeta text-tinta hover:border-esmeralda/50",
  reservado_app: "border-esmeralda/40 bg-esmeralda-tenue text-esmeralda cursor-not-allowed",
  bloqueado_manual: "border-oro/40 bg-oro-tenue text-oro",
  bloqueado_ical: "border-azul/35 bg-azul-tenue text-azul cursor-not-allowed",
};

export default function CalendarioPropietario() {
  const [propId, setPropId] = useState("prop-01");
  const [bloqueos, setBloqueos] = useState<Record<string, number[]>>(BLOQUEOS_INICIALES);
  const [tarifa, setTarifa] = useState(1_450_000);

  const prop = PROPIEDADES.find((p) => p.id === propId)!;
  const neto = useMemo(() => calcularNetoPropietario(tarifa), [tarifa]);

  const estadoDe = (dia: number): EstadoDia => {
    if (BASE[propId]?.[dia]) return BASE[propId][dia]!;
    if (bloqueos[propId]?.includes(dia)) return "bloqueado_manual";
    return "disponible";
  };

  const alternarBloqueo = (dia: number) => {
    const estado = estadoDe(dia);
    if (estado === "reservado_app" || estado === "bloqueado_ical") return;
    setBloqueos((prev) => ({
      ...prev,
      [propId]: prev[propId]?.includes(dia)
        ? prev[propId].filter((d) => d !== dia)
        : [...(prev[propId] ?? []), dia],
    }));
  };

  const offsetJulio2026 = 2; // 1 de julio de 2026 cae miércoles (semana inicia lunes)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-tinta">Calendario y tarifa neta</h1>
        <p className="mt-1 text-sm text-bruma">
          Eres el único con acceso de escritura. Toca un día disponible para
          bloquearlo (renta por fuera, mantenimiento, uso personal) y tócalo de
          nuevo para liberarlo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROPIEDADES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPropId(p.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              p.id === propId
                ? "border-esmeralda/50 bg-esmeralda-tenue text-esmeralda"
                : "border-borde text-bruma hover:border-borde-claro hover:text-tinta"
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* CALENDARIO */}
        <Card className="p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-tinta">Julio 2026</h2>
            <Badge tono="esmeralda">iCal sincronizado hace 4 min</Badge>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-bruma-osc">
            {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {Array.from({ length: offsetJulio2026 }).map((_, i) => (
              <div key={`v-${i}`} />
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => {
              const estado = estadoDe(dia);
              return (
                <button
                  key={dia}
                  onClick={() => alternarBloqueo(dia)}
                  className={`cifra aspect-square rounded-lg border text-sm transition ${ESTILO_DIA[estado]}`}
                  title={estado.replace("_", " ")}
                >
                  {dia}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-4 border-t border-borde pt-4 text-[11px] text-bruma">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded border border-borde bg-tarjeta" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-esmeralda/70" /> Reservado por la app (pago confirmado)</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-oro/70" /> Bloqueo manual tuyo</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-azul/70" /> Sincronizado Airbnb/Booking</span>
          </div>
          <p className="mt-4 rounded-xl border border-esmeralda/20 bg-esmeralda-tenue/40 p-3 text-[11px] leading-relaxed text-bruma">
            <span className="font-bold text-esmeralda">Sin holds:</span> una negociación
            o un link activo NO bloquean fechas. Solo el webhook del Pago 1 lo hace —
            por eso este calendario nunca miente.
          </p>
        </Card>

        {/* CALCULADORA DE NETO */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-xl text-tinta">Calculadora de neto</h2>
          <p className="mt-1 text-xs text-bruma">
            Fija tu tarifa sabiendo exactamente qué recibes. El ~3% de pasarela es tu
            único costo — la comisión de los comisionistas va por encima.
          </p>
          <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
            Tarifa neta por noche · {prop.nombre}
          </label>
          <input
            type="range"
            min={300_000}
            max={3_000_000}
            step={10_000}
            value={tarifa}
            onChange={(e) => setTarifa(Number(e.target.value))}
            className="mt-3 w-full accent-esmeralda"
          />
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-borde bg-panel px-4 py-3">
              <span className="text-sm text-bruma">Tarifa neta</span>
              <Money valor={neto.tarifaNeta} className="text-lg font-bold text-tinta" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-borde bg-panel px-4 py-3">
              <span className="text-sm text-bruma">Pasarela (~3%)</span>
              <Money valor={-neto.costoPasarelaEstimado} className="text-sm font-semibold text-rojo" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-esmeralda/30 bg-esmeralda-tenue px-4 py-3">
              <span className="text-sm font-semibold text-esmeralda">Tú recibes</span>
              <Money valor={neto.recibe} className="text-lg font-bold text-esmeralda" />
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-bruma-osc">
            Si el cliente paga más (comisión negociada por encima), la pasarela cobra
            sobre el total procesado; tu neto puede variar unos pesos. Siempre lo ves
            antes de confirmar.
          </p>
        </Card>
      </div>
    </div>
  );
}
