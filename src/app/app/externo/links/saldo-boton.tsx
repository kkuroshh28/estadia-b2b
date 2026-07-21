"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Money } from "@/components/ui";
import type { SaldoPendiente } from "@/lib/domain/paneles";

/** Genera el link del saldo (mitad 2) — el monto lo pone el motor, no la UI. */
export function SaldosPendientes({ saldos }: { saldos: SaldoPendiente[] }) {
  const router = useRouter();
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (saldos.length === 0) return null;

  const generar = async (reservaId: string) => {
    setCargando(reservaId);
    setError(null);
    try {
      const r = await fetch("/api/reservas/saldo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservaId, como: "externo" }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo generar el link");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el link");
    } finally {
      setCargando(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-rojo/30 bg-rojo-tenue p-2 text-[11px] text-rojo">{error}</p>
      )}
      {saldos.map((s) => (
        <Card key={s.reservaId} className="border-oro/30 bg-oro-tenue/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] text-bruma-osc">{s.codigo}</p>
              <p className="mt-1 font-semibold text-tinta">{s.propiedadNombre}</p>
              <p className="text-xs text-bruma">
                Anticipo pagado ✓ — falta el saldo (<Money valor={s.montoPesos} className="font-bold" />)
                para el semáforo verde.
              </p>
            </div>
            <button
              onClick={() => generar(s.reservaId)}
              disabled={cargando === s.reservaId}
              className="rounded-full bg-oro px-5 py-2.5 text-xs font-bold text-fondo transition hover:brightness-110 disabled:opacity-60"
            >
              {cargando === s.reservaId ? "Generando…" : "Generar link del saldo"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
