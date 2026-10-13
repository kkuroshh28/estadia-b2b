"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error dentro de la app: este boundary NO envuelve el layout de /app, así que
 * el shell (sidebar, nav inferior, campanita) sigue en pie y el usuario puede
 * reintentar o moverse a otra sección sin perder el contexto.
 */
export default function ErrorApp({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-borde bg-tarjeta p-8 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rojo">Error al cargar</p>
      <h1 className="mt-2 font-display text-2xl text-tinta">Esta sección no respondió</h1>
      <p className="mt-3 text-sm leading-relaxed text-bruma">
        El error quedó registrado. Ningún pago se procesa dos veces: si estabas
        operando un link, revisa su estado antes de repetir la acción.
      </p>
      {error.digest && <p className="cifra mt-2 text-[11px] text-bruma-osc">ref: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="min-h-11 rounded-full bg-tiffany px-6 py-2.5 text-sm font-bold text-noche transition hover:bg-tiffany-claro"
        >
          Reintentar
        </button>
        <Link
          href="/app"
          className="min-h-11 rounded-full border border-borde px-6 py-2.5 text-sm font-semibold text-bruma transition hover:text-tinta"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
