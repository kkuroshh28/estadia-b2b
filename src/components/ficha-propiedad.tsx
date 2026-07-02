"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Badge, Card, Cover, Money } from "@/components/ui";
import { MoneyAnimado } from "@/components/motion";
import { DIAS_OCUPADOS_JULIO } from "@/lib/data/demo";
import type { Propiedad } from "@/lib/domain/tipos";

/**
 * Ficha técnica + selector de fechas para solicitar renta.
 * Regla #4: los días ocupados están deshabilitados — ni siquiera clickeables.
 */
export function FichaPropiedad({ propiedad }: { propiedad: Propiedad }) {
  const ocupados = DIAS_OCUPADOS_JULIO[propiedad.id] ?? [];
  const [rango, setRango] = useState<{ desde: number | null; hasta: number | null }>({
    desde: null,
    hasta: null,
  });
  const [solicitada, setSolicitada] = useState(false);

  const rangoValido = (a: number, b: number) => {
    for (let d = a; d <= b; d++) if (ocupados.includes(d)) return false;
    return true;
  };

  const clickDia = (dia: number) => {
    if (ocupados.includes(dia) || solicitada) return;
    if (rango.desde === null || rango.hasta !== null) {
      setRango({ desde: dia, hasta: null });
      return;
    }
    const [a, b] = dia >= rango.desde ? [rango.desde, dia] : [dia, rango.desde];
    // Si el rango cruza un día ocupado, se reinicia desde el nuevo clic.
    if (!rangoValido(a, b)) {
      setRango({ desde: dia, hasta: null });
      return;
    }
    setRango({ desde: a, hasta: b });
  };

  const noches = rango.desde !== null && rango.hasta !== null ? rango.hasta - rango.desde : 0;
  const netaTotal = noches * propiedad.tarifaNetaNoche;
  const enRango = (d: number) =>
    rango.desde !== null && rango.hasta !== null && d >= rango.desde && d <= rango.hasta;

  const offsetJulio2026 = 2; // 1 jul 2026 = miércoles

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link href="/app/externo" className="text-xs font-semibold text-bruma transition hover:text-tinta">
        ← Volver a la búsqueda
      </Link>

      <div className="overflow-hidden rounded-2xl border border-borde">
        <Cover matiz={propiedad.matiz} className="h-44 sm:h-56" />
        <div className="flex flex-wrap items-start justify-between gap-4 bg-tarjeta p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl text-tinta">{propiedad.nombre}</h1>
              {propiedad.verificada && <Badge tono="esmeralda">Propiedad Verificada</Badge>}
            </div>
            <p className="mt-1 text-sm text-bruma">
              {propiedad.municipio} · {propiedad.zona} · {propiedad.tipo} ·{" "}
              {propiedad.capacidad} personas · {propiedad.habitaciones} hab · {propiedad.banos} baños
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma-osc">
              Tarifa neta / noche (confidencial)
            </p>
            <Money valor={propiedad.tarifaNetaNoche} className="text-2xl font-bold text-esmeralda" />
            <p className="text-[10px] text-oro">tu margen se negocia por encima</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* DATOS PARA VENDER */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-6">
            <h2 className="font-display text-lg text-tinta">Para venderla bien</h2>
            <ul className="mt-3 space-y-2 text-sm text-bruma">
              {propiedad.amenidades.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-esmeralda" /> {a}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-lg text-tinta">Reglas de la casa</h2>
            <ul className="mt-3 space-y-2 text-sm text-bruma">
              {propiedad.reglas.map((r) => (
                <li key={r} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-oro" /> {r}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-borde pt-3 text-[11px] text-bruma-osc">
              {propiedad.principalesVinculados} principales atienden esta propiedad —
              el primero que acepte tu solicitud negocia contigo.
            </p>
          </Card>
        </div>

        {/* FECHAS */}
        <Card className="p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-tinta">Julio 2026 · elige fechas</h2>
            <Badge tono="azul">Disponibilidad real</Badge>
          </div>
          <p className="mt-1 text-xs text-bruma">
            Toca el día de entrada y luego el de salida. Los días ocupados no se pueden tocar.
          </p>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-bruma-osc">
            {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {Array.from({ length: offsetJulio2026 }).map((_, i) => (
              <div key={`v-${i}`} />
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => {
              const ocupado = ocupados.includes(dia);
              const seleccionado = enRango(dia) || rango.desde === dia;
              return (
                <button
                  key={dia}
                  onClick={() => clickDia(dia)}
                  disabled={ocupado}
                  className={`cifra aspect-square rounded-lg border text-sm transition ${
                    ocupado
                      ? "cursor-not-allowed border-borde bg-panel text-bruma-osc line-through opacity-50"
                      : seleccionado
                        ? "border-esmeralda bg-esmeralda-tenue font-bold text-esmeralda"
                        : "border-borde bg-tarjeta text-tinta hover:border-esmeralda/50 hover:bg-tarjeta-alta"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {noches > 0 && !solicitada && (
              <motion.div
                key="resumen"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-esmeralda/25 bg-esmeralda-tenue/40 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-tinta">
                    {rango.desde} → {rango.hasta} jul · {noches} {noches === 1 ? "noche" : "noches"}
                  </p>
                  <p className="text-xs text-bruma">
                    Tarifa neta total <MoneyAnimado valor={netaTotal} className="font-bold text-esmeralda" /> — tu precio al cliente lo negocias con el principal.
                  </p>
                </div>
                <button
                  onClick={() => setSolicitada(true)}
                  className="rounded-full bg-esmeralda px-6 py-3 text-xs font-bold text-fondo transition hover:brightness-110"
                >
                  Solicitar estas fechas
                </button>
              </motion.div>
            )}
            {solicitada && (
              <motion.div
                key="ok"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="mt-5 rounded-xl border border-oro/30 bg-oro-tenue/40 p-4 text-center"
              >
                <p className="text-sm font-bold text-oro">Solicitud enviada a los {propiedad.principalesVinculados} principales</p>
                <p className="mt-1 text-xs text-bruma">
                  El primero que acepte se queda con ella y abre la negociación contigo.
                  Recuerda: las fechas NO están apartadas hasta que tu cliente pague el 50%.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
}
