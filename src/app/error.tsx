"use client";

import { useEffect } from "react";

export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Con SENTRY_DSN configurado, aquí se reporta (ver docs/PENDIENTES-KUROSH.md).
    console.error(error);
  }, [error]);

  return (
    <main className="atmosfera flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-2xl text-tinta">
        THE CIRCLE<span className="text-tiffany">.</span>
      </p>
      <p className="cifra mt-8 text-6xl font-bold text-borde-claro">500</p>
      <h1 className="mt-3 font-display text-3xl text-tinta">Algo salió mal de nuestro lado</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-bruma">
        El error quedó registrado. Ningún pago se procesa dos veces: si estabas
        pagando, revisa el estado del link antes de reintentar.
      </p>
      {error.digest && (
        <p className="cifra mt-2 text-[11px] text-bruma-osc">ref: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-tiffany px-6 py-3 text-sm font-bold text-tinta transition hover:bg-tiffany-claro"
      >
        Reintentar
      </button>
    </main>
  );
}
