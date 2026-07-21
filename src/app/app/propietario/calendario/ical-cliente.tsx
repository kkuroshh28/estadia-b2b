"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import type { IcalPropiedad } from "@/lib/domain/paneles";

/**
 * Sincronización iCal de la propiedad:
 * - EXPORTAR: URL .ics con token (pegarla en Airbnb/Booking) — así los otros
 *   canales respetan lo reservado aquí.
 * - IMPORTAR: URLs de Airbnb/Booking; el cron las lee cada 20 min y bloquea
 *   esos días (un conflicto con reserva pagada alerta al admin).
 */
export function SincronizacionIcal({
  propiedadId,
  ical,
}: {
  propiedadId: string;
  ical: IcalPropiedad;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copiar = async () => {
    await navigator.clipboard.writeText(ical.exportUrl).catch(() => null);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const llamar = async (cuerpo: object) => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/ical-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedadId, ...cuerpo }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo guardar");
      setUrl("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl text-tinta">Sincronización con Airbnb / Booking</h2>
        <Badge tono="esmeralda">cada 20 min</Badge>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {/* EXPORTAR */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
            Tu calendario para otros canales
          </p>
          <p className="mt-1 text-xs leading-relaxed text-bruma">
            Pega esta URL en Airbnb/Booking (&ldquo;importar calendario&rdquo;): tus reservas de
            THE CIRCLE bloquean esas plataformas.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-borde bg-panel px-3 py-2 text-[11px] text-bruma">
              {ical.exportUrl}
            </code>
            <button
              onClick={copiar}
              className="shrink-0 rounded-full bg-tiffany px-4 py-2 text-[11px] font-bold text-tinta transition hover:bg-tiffany-claro"
            >
              {copiado ? "Copiada ✓" : "Copiar"}
            </button>
          </div>
        </div>

        {/* IMPORTAR */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
            Calendarios externos que bloquean aquí
          </p>
          <div className="mt-3 space-y-2">
            {ical.imports.length === 0 && (
              <p className="text-xs text-bruma">Sin calendarios conectados todavía.</p>
            )}
            {ical.imports.map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-borde bg-panel px-3 py-2 text-[11px] text-bruma">
                  {i.url}
                </code>
                <button
                  onClick={() => llamar({ accion: "quitar", importId: i.id })}
                  disabled={cargando}
                  className="shrink-0 rounded-full border border-borde px-3 py-2 text-[11px] font-semibold text-bruma transition hover:border-rojo/40 hover:text-rojo"
                >
                  Quitar
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/…ics"
                className="min-w-0 flex-1 rounded-lg border border-borde bg-panel px-3 py-2 text-[11px] text-tinta placeholder:text-bruma-osc"
              />
              <button
                onClick={() => llamar({ accion: "agregar", url })}
                disabled={cargando || !url}
                className="shrink-0 rounded-full bg-tiffany px-4 py-2 text-[11px] font-bold text-tinta transition hover:bg-tiffany-claro disabled:opacity-50"
              >
                Conectar
              </button>
            </div>
            {error && <p className="text-[11px] text-rojo">{error}</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}
