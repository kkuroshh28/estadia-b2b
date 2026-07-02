"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card, Cover, Money } from "@/components/ui";
import { PROPIEDADES } from "@/lib/data/demo";

/**
 * Búsqueda del Comisionista Externo: solo propiedades con disponibilidad REAL
 * en las fechas pedidas, con la tarifa neta visible (confidencial: jamás se
 * muestra al cliente final).
 */
export default function BusquedaExterno() {
  const [zona, setZona] = useState("todas");
  const [capacidad, setCapacidad] = useState(2);
  const [maxNoche, setMaxNoche] = useState(3_000_000);
  const [solicitadas, setSolicitadas] = useState<string[]>([]);

  const zonas = ["todas", ...new Set(PROPIEDADES.map((p) => p.zona))];

  const resultados = useMemo(
    () =>
      PROPIEDADES.filter(
        (p) =>
          (zona === "todas" || p.zona === zona) &&
          p.capacidad >= capacidad &&
          p.tarifaNetaNoche <= maxNoche &&
          p.verificada,
      ),
    [zona, capacidad, maxNoche],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-tinta">Buscar disponibilidad</h1>
        <p className="mt-1 text-sm text-bruma">
          Todo lo que ves está libre de verdad: los días ocupados ni siquiera
          aparecen. Tu cliente es tuyo — la plataforma jamás lo contacta.
        </p>
      </div>

      {/* FILTROS */}
      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-bruma-osc">
              Fechas (obligatorio)
            </label>
            <div className="mt-2 rounded-lg border border-tiffany bg-tiffany-bruma px-3 py-2 text-xs font-semibold text-tinta">
              17 jul → 20 jul · 3 noches
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-bruma-osc">Zona</label>
            <select
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              className="mt-2 w-full rounded-lg border border-borde bg-panel px-3 py-2 text-xs text-tinta"
            >
              {zonas.map((z) => (
                <option key={z} value={z}>
                  {z === "todas" ? "Todas las zonas" : z}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-bruma-osc">
              Capacidad mínima: {capacidad}
            </label>
            <input
              type="range"
              min={1}
              max={14}
              value={capacidad}
              onChange={(e) => setCapacidad(Number(e.target.value))}
              className="mt-3 w-full accent-tiffany"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-bruma-osc">
              Tarifa neta máx: <Money valor={maxNoche} />
            </label>
            <input
              type="range"
              min={400_000}
              max={3_000_000}
              step={50_000}
              value={maxNoche}
              onChange={(e) => setMaxNoche(Number(e.target.value))}
              className="mt-3 w-full accent-tiffany"
            />
          </div>
        </div>
      </Card>

      {/* RESULTADOS */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {resultados.map((p) => {
          const solicitada = solicitadas.includes(p.id);
          return (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              <Cover matiz={p.matiz} className="h-32" />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight text-tinta">{p.nombre}</h3>
                    <p className="mt-0.5 text-xs text-bruma">
                      {p.municipio} · {p.capacidad} personas · {p.habitaciones} hab
                    </p>
                  </div>
                  <Badge tono="esmeralda">Verificada</Badge>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-bruma-osc">
                  {p.amenidades.slice(0, 3).join(" · ")}
                </p>
                <Link
                  href={`/app/externo/propiedad/${p.id}`}
                  className="mt-2 text-[11px] font-semibold text-esmeralda hover:underline"
                >
                  Ver ficha técnica y fechas →
                </Link>
                <div className="mt-auto flex items-end justify-between border-t border-borde pt-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma-osc">
                      Tarifa neta / noche
                    </p>
                    <Money valor={p.tarifaNetaNoche} className="text-base font-bold text-esmeralda" />
                    <p className="text-[10px] text-oro">tu margen va por encima</p>
                  </div>
                  <button
                    onClick={() => setSolicitadas((s) => [...s, p.id])}
                    disabled={solicitada}
                    className={`rounded-full px-4 py-2 text-[11px] font-bold transition ${
                      solicitada
                        ? "cursor-default border border-esmeralda/40 bg-esmeralda-tenue text-esmeralda"
                        : "bg-tiffany text-tinta hover:bg-tiffany-claro"
                    }`}
                  >
                    {solicitada ? "Enviada ✓" : "Solicitar renta"}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {resultados.length === 0 && (
        <Card className="p-10 text-center text-sm text-bruma">
          Ninguna propiedad verificada cumple esos filtros. Ajusta zona, capacidad o precio.
        </Card>
      )}
      <p className="text-[11px] text-bruma-osc">
        Confidencialidad: la tarifa neta es visible solo para comisionistas
        verificados. Filtrarla a un cliente final es falta grave.
      </p>
    </div>
  );
}
