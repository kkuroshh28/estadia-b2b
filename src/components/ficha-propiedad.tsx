"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Badge, Card, Cover, Money } from "@/components/ui";
import { MoneyAnimado } from "@/components/motion";
import { mesVecino, type DatosFicha } from "@/lib/domain/paneles";

/**
 * Ficha técnica + selector de fechas para solicitar renta.
 * Regla #4: los días ocupados están deshabilitados — ni siquiera clickeables.
 */
export function FichaPropiedad({ datos }: { datos: DatosFicha }) {
  const { propiedad, mesTitulo, diasDelMes, offsetLunes, ocupados, mesIso, esDemo } = datos;
  const router = useRouter();
  const pathname = usePathname();
  const irAlMes = (delta: 1 | -1) => {
    router.push(`${pathname}?mes=${mesVecino(mesIso, delta)}`);
    setRango({ desde: null, hasta: null });
  };
  const [rango, setRango] = useState<{ desde: number | null; hasta: number | null }>({
    desde: null,
    hasta: null,
  });
  const [solicitada, setSolicitada] = useState(false);
  const [huespedes, setHuespedes] = useState(Math.min(2, propiedad.capacidad));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaIso = (dia: number) => `${mesIso}-${String(dia).padStart(2, "0")}`;

  const solicitar = async () => {
    if (esDemo) {
      setSolicitada(true);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propiedadId: propiedad.id,
          desde: fechaIso(rango.desde!),
          hasta: fechaIso(rango.hasta!),
          huespedes,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo enviar la solicitud");
      setSolicitada(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => irAlMes(-1)}
                aria-label="Mes anterior"
                className="flex size-8 items-center justify-center rounded-full border border-borde text-bruma transition hover:border-tiffany hover:text-tinta"
              >
                ‹
              </button>
              <h2 className="min-w-44 text-center font-display text-xl text-tinta">{mesTitulo}</h2>
              <button
                onClick={() => irAlMes(1)}
                aria-label="Mes siguiente"
                className="flex size-8 items-center justify-center rounded-full border border-borde text-bruma transition hover:border-tiffany hover:text-tinta"
              >
                ›
              </button>
            </div>
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
            {Array.from({ length: offsetLunes }).map((_, i) => (
              <div key={`v-${i}`} />
            ))}
            {Array.from({ length: diasDelMes }, (_, i) => i + 1).map((dia) => {
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
                        ? "border-tiffany bg-tiffany-bruma font-bold text-tinta"
                        : "border-borde bg-tarjeta text-tinta hover:border-tiffany hover:bg-tarjeta-alta"
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
                className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-tiffany-claro bg-tiffany-bruma/40 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-tinta">
                    {rango.desde} → {rango.hasta} · {noches} {noches === 1 ? "noche" : "noches"}
                  </p>
                  <p className="text-xs text-bruma">
                    Tarifa neta total <MoneyAnimado valor={netaTotal} className="font-bold text-esmeralda" /> — tu precio al cliente lo negocias con el principal.
                  </p>
                  {error && (
                    <p className="mt-2 rounded-lg border border-rojo/30 bg-rojo-tenue p-2 text-[11px] text-rojo">
                      {error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-bruma">
                    Huéspedes
                    <input
                      type="number"
                      min={1}
                      max={propiedad.capacidad}
                      value={huespedes}
                      onChange={(e) => setHuespedes(Number(e.target.value))}
                      className="w-14 rounded-lg border border-borde bg-panel px-2 py-1.5 text-center text-xs text-tinta"
                    />
                  </label>
                  <button
                    onClick={solicitar}
                    disabled={enviando}
                    className="rounded-full bg-tiffany px-6 py-3 text-xs font-bold text-tinta transition hover:bg-tiffany-claro disabled:opacity-60"
                  >
                    {enviando ? "Enviando…" : "Solicitar estas fechas"}
                  </button>
                </div>
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
