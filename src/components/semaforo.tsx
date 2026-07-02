"use client";

import { motion } from "motion/react";
import type { Reserva } from "@/lib/domain/tipos";
import { entregaAutorizada, progresoReserva } from "@/lib/domain/reserva";
import { EstadoBadge, Money } from "./ui";

/**
 * Semáforo de pagos (§5): la pantalla en tiempo real que autoriza —o no—
 * la entrega de llaves/códigos. Sin "Pago completo ✓" no hay entrega.
 */
export function Semaforo({ reserva, propiedadNombre }: { reserva: Reserva; propiedadNombre: string }) {
  const verde = entregaAutorizada(reserva.estado);
  const progreso = progresoReserva(reserva.estado);
  return (
    <div className="rounded-2xl border border-borde bg-tarjeta p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-wider text-bruma-osc">{reserva.codigo}</p>
          <p className="mt-0.5 font-semibold text-tinta">{propiedadNombre}</p>
          <p className="mt-0.5 text-xs text-bruma">
            {reserva.fechas.desde} → {reserva.fechas.hasta} · {reserva.noches} noches ·{" "}
            {reserva.aliasExterno}
          </p>
        </div>
        <EstadoBadge estado={reserva.estado} vivo={!verde && progreso > 0 && progreso < 100} />
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-borde">
        <motion.div
          className={`h-full rounded-full ${verde ? "bg-esmeralda" : "bg-oro"}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${progreso}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma-osc">Precio final</p>
            <Money valor={reserva.precioFinal} className="text-sm font-bold text-tinta" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma-osc">Tarifa neta</p>
            <Money valor={reserva.tarifaNetaTotal} className="text-sm font-bold text-bruma" />
          </div>
        </div>
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
            verde
              ? "border-esmeralda/30 bg-esmeralda-tenue text-esmeralda"
              : "border-borde-claro bg-panel text-bruma"
          }`}
        >
          <span className={`size-2 rounded-full ${verde ? "bg-esmeralda pulso" : "bg-bruma-osc"}`} />
          {verde ? "Entrega autorizada" : "Entrega NO autorizada"}
        </div>
      </div>
    </div>
  );
}
