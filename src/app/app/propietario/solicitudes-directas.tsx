"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarAlias, Badge, Card } from "@/components/ui";
import type { SolicitudPanel } from "@/lib/domain/paneles";

/**
 * Anexo I — Gestión directa: el DUEÑO recibe y acepta las solicitudes de sus
 * propiedades Owner Direct y negocia él mismo en el módulo de negociación.
 */
export function SolicitudesDirectas({ solicitudes }: { solicitudes: SolicitudPanel[] }) {
  const router = useRouter();
  const [aceptadas, setAceptadas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (solicitudes.length === 0) return null;

  const aceptar = async (solicitudId: string) => {
    setError(null);
    try {
      const r = await fetch("/api/solicitudes/aceptar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId, como: "propietario" }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo aceptar");
      if (json.gano) {
        setAceptadas((a) => [...a, solicitudId]);
        router.refresh();
      } else {
        setError("La solicitud expiró o ya no está disponible.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aceptar");
    }
  };

  return (
    <section>
      <h2 className="font-display text-2xl text-tinta">Solicitudes · gestión directa</h2>
      <p className="mt-1 text-sm text-bruma">
        Estas propiedades las gestionas tú: acepta y negocia directamente con el
        socio de ventas. Recibes tu tarifa neta MÁS la participación comercial.
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-rojo/30 bg-rojo-tenue p-2 text-[11px] text-rojo">{error}</p>
      )}
      <div className="mt-5 space-y-4">
        {solicitudes.map((s) => {
          const aceptada = aceptadas.includes(s.id) || s.estado === "aceptada";
          return (
            <Card key={s.id} alta className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <AvatarAlias alias={s.aliasExterno} size={42} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold text-tinta">{s.aliasExterno}</p>
                      <span className="text-xs text-bruma">solicita</span>
                      <p className="text-sm font-semibold text-tinta">{s.propiedadNombre}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-bruma">
                      {s.fechas.desde} → {s.fechas.hasta} · {s.noches} noches · {s.huespedes} huéspedes
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {aceptada ? (
                    <>
                      <Badge tono="esmeralda">Tuya — a negociar</Badge>
                      <Link
                        href="/app/negociacion"
                        className="rounded-full bg-oro px-5 py-2.5 text-xs font-bold text-fondo transition hover:brightness-110"
                      >
                        Negociar precio →
                      </Link>
                    </>
                  ) : (
                    <>
                      <Badge tono="ambar" vivo>
                        {s.recibidaHace} · vence en {s.vigenciaMin} min
                      </Badge>
                      <button
                        onClick={() => aceptar(s.id)}
                        className="rounded-full bg-tiffany px-5 py-2.5 text-xs font-bold text-tinta transition hover:bg-tiffany-claro"
                      >
                        Aceptar solicitud
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
