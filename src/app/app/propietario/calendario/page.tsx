"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Badge, Card } from "@/components/ui";
import { MoneyAnimado } from "@/components/motion";
import { PROPIEDADES } from "@/lib/data/demo";
import { calcularNetoPropietario } from "@/lib/domain/split";
import type { EstadoDia } from "@/lib/domain/tipos";

/**
 * Calendario de julio 2026 — una sola fuente de verdad de disponibilidad.
 * Solo el propietario tiene acceso de escritura. Bloqueo manual por clic o
 * arrastrando para seleccionar un rango. Los días reservados por la app son
 * intocables: los bloqueó el dinero.
 */

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
  disponible:
    "border-borde bg-panel text-tinta hover:border-tiffany hover:bg-tiffany-bruma cursor-pointer",
  reservado_app: "border-tiffany bg-tiffany font-bold text-tinta cursor-not-allowed",
  bloqueado_manual: "rayado border-borde-claro bg-panel text-bruma cursor-pointer",
  bloqueado_ical: "border-tiffany-claro bg-tiffany-claro/45 text-tinta cursor-not-allowed",
};

export default function CalendarioPropietario() {
  const [propId, setPropId] = useState("prop-01");
  const [bloqueos, setBloqueos] = useState<Record<string, number[]>>(BLOQUEOS_INICIALES);
  const [recientes, setRecientes] = useState<number[]>([]);
  const [tarifa, setTarifa] = useState(1_450_000);
  const arrastre = useRef<{ inicio: number; hasta: number } | null>(null);
  const [rangoVivo, setRangoVivo] = useState<[number, number] | null>(null);

  const prop = PROPIEDADES.find((p) => p.id === propId)!;
  const neto = useMemo(() => calcularNetoPropietario(tarifa), [tarifa]);

  const estadoDe = (dia: number): EstadoDia => {
    if (BASE[propId]?.[dia]) return BASE[propId][dia]!;
    if (bloqueos[propId]?.includes(dia)) return "bloqueado_manual";
    return "disponible";
  };

  const editable = (dia: number) => {
    const e = estadoDe(dia);
    return e === "disponible" || e === "bloqueado_manual";
  };

  const empezarArrastre = (dia: number) => {
    if (!editable(dia)) return;
    arrastre.current = { inicio: dia, hasta: dia };
    setRangoVivo([dia, dia]);
  };

  const extenderArrastre = (dia: number) => {
    if (!arrastre.current) return;
    arrastre.current.hasta = dia;
    setRangoVivo([
      Math.min(arrastre.current.inicio, dia),
      Math.max(arrastre.current.inicio, dia),
    ]);
  };

  const terminarArrastre = () => {
    const drag = arrastre.current;
    arrastre.current = null;
    setRangoVivo(null);
    if (!drag) return;
    const [a, b] = [Math.min(drag.inicio, drag.hasta), Math.max(drag.inicio, drag.hasta)];
    const dias = Array.from({ length: b - a + 1 }, (_, i) => a + i).filter(editable);
    if (dias.length === 0) return;

    setBloqueos((prev) => {
      const actuales = prev[propId] ?? [];
      // Un solo día ya bloqueado → toggle (desbloquear); si no, bloquear el rango.
      if (a === b && actuales.includes(a)) {
        return { ...prev, [propId]: actuales.filter((d) => d !== a) };
      }
      const nuevos = dias.filter((d) => !actuales.includes(d));
      setRecientes(nuevos);
      return { ...prev, [propId]: [...actuales, ...nuevos] };
    });
  };

  const enRangoVivo = (dia: number) =>
    rangoVivo !== null && dia >= rangoVivo[0] && dia <= rangoVivo[1] && editable(dia);

  const offsetJulio2026 = 2; // 1 de julio de 2026 cae miércoles (semana inicia lunes)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-tinta">Calendario y tarifa neta</h1>
        <p className="mt-1 text-sm text-bruma">
          Eres el único con acceso de escritura. Haz clic en un día para bloquearlo o
          liberarlo, o arrastra para bloquear un rango completo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROPIEDADES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPropId(p.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              p.id === propId
                ? "border-tiffany bg-tiffany-bruma text-tinta"
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
          <div
            className="mt-2 grid select-none grid-cols-7 gap-1.5"
            style={{ touchAction: "none" }}
            onPointerUp={terminarArrastre}
            onPointerLeave={terminarArrastre}
          >
            {Array.from({ length: offsetJulio2026 }).map((_, i) => (
              <div key={`v-${i}`} />
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => {
              const estado = estadoDe(dia);
              const seleccionando = enRangoVivo(dia);
              const recien = recientes.includes(dia) && estado === "bloqueado_manual";
              return (
                <button
                  key={dia}
                  onPointerDown={() => empezarArrastre(dia)}
                  onPointerEnter={() => extenderArrastre(dia)}
                  disabled={!editable(dia)}
                  className={`cifra relative aspect-square rounded-lg border text-sm transition ${
                    seleccionando
                      ? "border-oro bg-oro-tenue text-oro"
                      : ESTILO_DIA[estado]
                  }`}
                  title={estado.replace("_", " ")}
                >
                  {dia}
                  {recien && (
                    <motion.span
                      initial={{ scale: 0, rotate: -35, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-tinta text-[9px] text-white"
                    >
                      🔒
                    </motion.span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-4 border-t border-borde pt-4 text-[11px] text-bruma">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded border border-borde bg-panel" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-tiffany" /> Reservado por la app (pago confirmado)</span>
            <span className="flex items-center gap-1.5"><span className="rayado size-2.5 rounded border border-borde-claro" /> Bloqueo manual tuyo</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-tiffany-claro" /> Sincronizado Airbnb/Booking</span>
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
            className="mt-3 w-full accent-tiffany"
          />
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-borde bg-panel px-4 py-3">
              <span className="text-sm text-bruma">Tarifa neta</span>
              <MoneyAnimado valor={neto.tarifaNeta} className="text-lg font-bold text-tinta" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-borde bg-panel px-4 py-3">
              <span className="text-sm text-bruma">Pasarela (~3%)</span>
              <MoneyAnimado valor={-neto.costoPasarelaEstimado} className="text-sm font-semibold text-rojo" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-esmeralda/30 bg-esmeralda-tenue px-4 py-3">
              <span className="text-sm font-semibold text-esmeralda">Tú recibes</span>
              <MoneyAnimado valor={neto.recibe} className="text-lg font-bold text-esmeralda" />
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
