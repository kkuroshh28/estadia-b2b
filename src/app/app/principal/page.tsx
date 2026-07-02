"use client";

import { useState } from "react";
import Link from "next/link";
import { AvatarAlias, Badge, Card, Money, Stat } from "@/components/ui";
import { Semaforo } from "@/components/semaforo";
import { RESERVAS, SOLICITUDES, propiedadPorId } from "@/lib/data/demo";

export default function PanelPrincipal() {
  const [aceptadas, setAceptadas] = useState<string[]>([]);
  const misReservas = RESERVAS.filter((r) => r.aliasPrincipal === "CONDOR-472");

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-tinta">Solicitudes entrantes</h1>
          <p className="mt-1 text-sm text-bruma">
            El primero en aceptar se queda con la solicitud. Tu velocidad de
            respuesta es parte de tu reputación.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AvatarAlias alias="CONDOR-472" />
          <div>
            <p className="font-mono text-sm font-bold text-oro">CONDOR-472</p>
            <p className="text-[11px] text-bruma">38 reservas · responde en ~6 min</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat etiqueta="Comisiones · julio" valor={<Money valor={2_340_000} />} detalle="50% de cada comisión acordada" tono="oro" />
        <Stat etiqueta="Tasa de aceptación" valor="94%" detalle="Top 5% del gremio" tono="esmeralda" />
        <Stat etiqueta="Propiedades vinculadas" valor="3" detalle="Por invitación directa del propietario" />
      </div>

      {/* BANDEJA */}
      <section className="space-y-4">
        {SOLICITUDES.filter((s) => s.estado === "pendiente").map((s) => {
          const p = propiedadPorId(s.propiedadId);
          const aceptada = aceptadas.includes(s.id);
          return (
            <Card key={s.id} alta className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <AvatarAlias alias={s.aliasExterno} size={42} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold text-tinta">{s.aliasExterno}</p>
                      <span className="text-xs text-bruma">solicita</span>
                      <p className="text-sm font-semibold text-tinta">{p.nombre}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-bruma">
                      {s.fechas.desde} → {s.fechas.hasta} · {s.noches} noches ·{" "}
                      {s.huespedes} huéspedes · tarifa neta total{" "}
                      <Money valor={p.tarifaNetaNoche * s.noches} className="text-esmeralda" />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {aceptada ? (
                    <>
                      <Badge tono="esmeralda">Tuya — eres el primero</Badge>
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
                        onClick={() => setAceptadas((a) => [...a, s.id])}
                        className="rounded-full bg-esmeralda px-5 py-2.5 text-xs font-bold text-fondo transition hover:brightness-110"
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
        <p className="text-[11px] text-bruma-osc">
          Aceptar no bloquea fechas: hasta que entre el Pago 1, otras solicitudes
          sobre las mismas fechas siguen corriendo en paralelo. El primero que paga, gana.
        </p>
      </section>

      {/* RESERVAS */}
      <section>
        <h2 className="font-display text-2xl text-tinta">Mis reservas activas</h2>
        <p className="mt-1 text-sm text-bruma">
          El semáforo en verde es tu única autorización para coordinar la entrega.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {misReservas.map((r) => (
            <Semaforo key={r.id} reserva={r} propiedadNombre={propiedadPorId(r.propiedadId).nombre} />
          ))}
        </div>
      </section>
    </div>
  );
}
