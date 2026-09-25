"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

/**
 * Campanita de notificaciones in-app. Consulta al montar y al abrir; marca
 * todo leído al abrir el panel. `rol` = el rol del panel activo (con sesión
 * real, el servidor solo entrega las del usuario de la sesión).
 */

interface Noti {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  url: string | null;
  leida: boolean;
}

const ICONO: Record<string, string> = {
  solicitud: "◉",
  aceptada: "✓",
  oferta: "⇄",
  acuerdo: "🤝",
  pago: "$",
};

export function Campanita({ rol }: { rol: "propietario" | "principal" | "externo" }) {
  const [abierta, setAbierta] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<Noti[]>([]);

  const cargar = async () => {
    try {
      const r = await fetch(`/api/notificaciones?como=${rol}`);
      if (!r.ok) return;
      const json = await r.json();
      setNoLeidas(json.noLeidas);
      setItems(json.items);
    } catch {
      // sin red: la campanita no molesta
    }
  };

  useEffect(() => {
    // El primer setState llega tras el await del fetch (nunca síncrono).
    const primero = setTimeout(cargar, 0);
    const t = setInterval(cargar, 60_000);
    return () => {
      clearTimeout(primero);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol]);

  const abrir = async () => {
    setAbierta((v) => !v);
    if (!abierta && noLeidas > 0) {
      await fetch("/api/notificaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ como: rol }),
      }).catch(() => null);
      setNoLeidas(0);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={abrir}
        aria-label={`Notificaciones${noLeidas ? ` (${noLeidas} sin leer)` : ""}`}
        className="relative flex size-8 items-center justify-center rounded-full border border-borde text-bruma transition hover:border-tiffany hover:text-tinta"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rojo text-[9px] font-bold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      <AnimatePresence>
        {abierta && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-2xl elevada-alta border border-borde bg-panel"
          >
            <p className="border-b border-borde px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-bruma-osc">
              Notificaciones
            </p>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-bruma">
                  Nada por ahora. Aquí llegan solicitudes, ofertas y pagos.
                </p>
              )}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.url ?? "#"}
                  onClick={() => setAbierta(false)}
                  className={`block border-b border-borde px-4 py-3 transition hover:bg-tarjeta ${
                    n.leida ? "opacity-60" : ""
                  }`}
                >
                  <p className="flex items-center gap-2 text-xs font-bold text-tinta">
                    <span className="text-tiffany-profundo">{ICONO[n.tipo] ?? "•"}</span>
                    {n.titulo}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-bruma">{n.cuerpo}</p>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
