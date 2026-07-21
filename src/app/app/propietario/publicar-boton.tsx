"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Publicar/despublicar la propiedad (visible u oculta para el gremio). */
export function PublicarBoton({
  propiedadId,
  publicada,
}: {
  propiedadId: string;
  publicada: boolean;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  const alternar = async () => {
    setCargando(true);
    try {
      await fetch("/api/propiedades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedadId, publicada: !publicada }),
      });
      router.refresh();
    } finally {
      setCargando(false);
    }
  };

  return (
    <button
      onClick={alternar}
      disabled={cargando}
      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition disabled:opacity-50 ${
        publicada
          ? "border-borde text-bruma hover:border-rojo/40 hover:text-rojo"
          : "border-esmeralda/40 bg-esmeralda-tenue text-esmeralda hover:brightness-105"
      }`}
    >
      {cargando ? "…" : publicada ? "Despublicar" : "Publicar"}
    </button>
  );
}
