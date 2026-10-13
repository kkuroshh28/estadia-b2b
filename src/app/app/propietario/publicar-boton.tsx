"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BASE =
  "min-h-11 rounded-full border px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Publicar/despublicar la propiedad (visible u oculta para el gremio).
 * - Sin tarifa neta no se puede publicar (el servidor también lo rechaza).
 * - Despublicar pide confirmación EN LÍNEA de dos pasos (sin diálogos del navegador).
 */
export function PublicarBoton({
  propiedadId,
  publicada,
  tarifaNetaNoche,
}: {
  propiedadId: string;
  publicada: boolean;
  tarifaNetaNoche?: number | null;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinTarifa = !tarifaNetaNoche || tarifaNetaNoche <= 0;

  const alternar = async () => {
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/propiedades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedadId, publicada: !publicada }),
      });
      if (!r.ok) {
        setError((await r.json().catch(() => null))?.error ?? "No se pudo cambiar la publicación.");
        return;
      }
      setConfirmando(false);
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  let control: React.ReactNode;
  if (publicada && confirmando) {
    control = (
      <div role="group" aria-label="Confirmar despublicación" className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="text-[11px] text-bruma">¿Ocultar del gremio?</span>
        <button
          type="button"
          onClick={alternar}
          disabled={cargando}
          autoFocus
          className={`${BASE} border-rojo/40 bg-rojo-tenue text-rojo hover:brightness-110`}
        >
          {cargando ? "…" : "Sí, despublicar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={cargando}
          className={`${BASE} border-borde text-bruma hover:text-tinta`}
        >
          Cancelar
        </button>
      </div>
    );
  } else if (publicada) {
    control = (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmando(true);
        }}
        className={`${BASE} border-borde text-bruma hover:border-rojo/40 hover:text-rojo`}
      >
        Despublicar
      </button>
    );
  } else {
    control = (
      <button
        type="button"
        onClick={alternar}
        disabled={cargando || sinTarifa}
        title={sinTarifa ? "Define la tarifa neta para poder publicar" : undefined}
        className={`${BASE} border-esmeralda/40 bg-esmeralda-tenue text-esmeralda hover:brightness-105`}
      >
        {cargando ? "…" : sinTarifa ? "Define tarifa primero" : "Publicar"}
      </button>
    );
  }

  return (
    <>
      {control}
      {error && (
        <p role="alert" className="max-w-40 text-right text-[10px] leading-snug text-rojo">
          {error}
        </p>
      )}
    </>
  );
}
