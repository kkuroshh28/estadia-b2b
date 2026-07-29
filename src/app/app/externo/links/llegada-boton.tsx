"use client";

import { useState } from "react";

/** Revelación controlada para el socio de ventas: solo con semáforo verde. */
export function LlegadaBoton({ reservaId }: { reservaId: string }) {
  const [llegada, setLlegada] = useState<{ direccion: string | null; indicaciones: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ver = async () => {
    setError(null);
    try {
      const r = await fetch("/api/reservas/llegada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservaId, como: "externo" }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No disponible");
      setLlegada({ direccion: json.direccion, indicaciones: json.indicaciones });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No disponible");
    }
  };

  if (llegada) {
    return (
      <div className="mt-3 rounded-xl border border-esmeralda/25 bg-esmeralda-tenue/40 p-3 text-xs leading-relaxed text-tinta">
        <p className="text-[10px] font-bold uppercase tracking-wider text-esmeralda">
          Datos de llegada para tu cliente
        </p>
        <p className="mt-1.5">
          <span className="font-bold">Dirección:</span>{" "}
          {llegada.direccion ?? "el propietario aún no la registró"}
        </p>
        {llegada.indicaciones && (
          <p className="mt-1">
            <span className="font-bold">Indicaciones:</span> {llegada.indicaciones}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-3">
      <button
        onClick={ver}
        className="rounded-full border border-esmeralda/40 bg-esmeralda-tenue px-4 py-2 text-[11px] font-bold text-esmeralda transition hover:brightness-105"
      >
        Ver datos de llegada 🔓
      </button>
      {error && <p className="mt-1.5 text-[11px] text-rojo">{error}</p>}
    </div>
  );
}
