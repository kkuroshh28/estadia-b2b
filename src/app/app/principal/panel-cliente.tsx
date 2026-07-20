"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AvatarAlias, Badge, Card, Money, Stat } from "@/components/ui";
import { Semaforo } from "@/components/semaforo";
import type { DatosPrincipal } from "@/lib/domain/paneles";

export function PanelPrincipalCliente({ datos }: { datos: DatosPrincipal }) {
  const [aceptadas, setAceptadas] = useState<string[]>([]);
  const [toast, setToast] = useState(false);
  const alias = datos.aliasYo ?? "—";
  const completadas = datos.reservas.filter((r) => r.estado === "COMPLETADA").length;

  // Demo tiempo real: a los 6 s "entra" una solicitud nueva (solo demo pública).
  useEffect(() => {
    if (!datos.esDemo) return;
    const entra = setTimeout(() => setToast(true), 6000);
    const sale = setTimeout(() => setToast(false), 14000);
    return () => { clearTimeout(entra); clearTimeout(sale); };
  }, [datos.esDemo]);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* TOAST de solicitud entrante */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="fixed right-4 top-16 z-50 w-80 rounded-2xl elevada-alta border border-tiffany-claro bg-panel p-4"
          >
            <div className="flex items-start gap-3">
              <AvatarAlias alias="YARUMO-611" size={36} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-oro">Nueva solicitud entrante</p>
                <p className="mt-0.5 text-xs text-tinta">
                  <span className="font-mono">YARUMO-611</span> pide Glamping Bosque
                  Nublado · 8–10 ago · 2 noches
                </p>
                <p className="mt-1 text-[10px] text-bruma-osc">
                  El primero que acepte se la queda — corre.
                </p>
              </div>
              <button onClick={() => setToast(false)} className="text-bruma-osc hover:text-tinta">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-tinta">Solicitudes entrantes</h1>
          <p className="mt-1 text-sm text-bruma">
            El primero en aceptar se queda con la solicitud. Tu velocidad de
            respuesta es parte de tu reputación.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AvatarAlias alias={alias} />
          <div>
            <p className="font-mono text-sm font-bold text-tinta">{alias}</p>
            <p className="text-[11px] text-bruma">
              {datos.esDemo ? "38 reservas · responde en ~6 min" : `${completadas} reservas completadas`}
            </p>
          </div>
        </div>
      </div>

      {datos.esDemo && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat etiqueta="Comisiones · julio" valor={<Money valor={2_340_000} />} detalle="50% de cada comisión acordada" tono="oro" />
          <Stat etiqueta="Tasa de aceptación" valor="94%" detalle="Top 5% del gremio" tono="esmeralda" />
          <Stat etiqueta="Propiedades vinculadas" valor="3" detalle="Por invitación directa del propietario" />
        </div>
      )}

      {/* BANDEJA */}
      <section className="space-y-4">
        {datos.solicitudes.filter((s) => s.estado === "pendiente").length === 0 && (
          <Card className="p-6 text-sm text-bruma">
            Sin solicitudes pendientes ahora mismo. Cuando un externo pida fechas de
            tus propiedades vinculadas, aparecerán aquí al instante.
          </Card>
        )}
        {datos.solicitudes.filter((s) => s.estado === "pendiente").map((s) => {
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
                      <p className="text-sm font-semibold text-tinta">{s.propiedadNombre}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-bruma">
                      {s.fechas.desde} → {s.fechas.hasta} · {s.noches} noches ·{" "}
                      {s.huespedes} huéspedes
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
        {datos.reservas.length === 0 ? (
          <Card className="mt-5 p-6 text-sm text-bruma">Aún no tienes reservas.</Card>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {datos.reservas.map((r) => (
              <Semaforo key={r.id} reserva={r} propiedadNombre={r.propiedadNombre} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
