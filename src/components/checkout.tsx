"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LinkDePago } from "@/lib/domain/tipos";
import { Money } from "./ui";

/**
 * Checkout del cliente final — web, FUERA de la app. Sin desgloses de comisión.
 * Al "pagar": procesando → confirmación animada. El split que se muestra después
 * es didáctico del demo (el cliente real jamás lo ve).
 */
export function Checkout({ link }: { link: LinkDePago }) {
  const [fase, setFase] = useState<"form" | "procesando" | "pagado">(
    link.estado === "pagado" ? "pagado" : "form",
  );
  const [error, setError] = useState<string | null>(null);
  const muerto = link.estado === "invalidado" || link.estado === "expirado";

  const pagar = async () => {
    setFase("procesando");
    setError(null);
    // Pasarela simulada REAL: el evento entra por el MISMO webhook firmado
    // (idempotencia, lock de días, splits). "El primero que paga, gana" aplica.
    try {
      const r = await fetch("/api/pagos/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: link.id, montoCentavos: link.monto * 100 }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "El pago no pudo procesarse");
      if (json.resultado === "procesado" || json.resultado === "duplicado") {
        setTimeout(() => setFase("pagado"), 900);
      } else {
        // fechas_tomadas u otro terminal: recargar muestra el link invalidado
        window.location.reload();
      }
    } catch (e) {
      setFase("form");
      setError(e instanceof Error ? e.message : "El pago no pudo procesarse");
    }
  };

  if (muerto) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-borde bg-tarjeta p-8 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="mx-auto flex size-14 items-center justify-center rounded-full border border-rojo/40 bg-rojo-tenue text-2xl"
        >
          ✕
        </motion.div>
        <h1 className="mt-5 font-display text-2xl text-tinta">Fechas ya no disponibles</h1>
        <p className="mt-3 text-sm leading-relaxed text-bruma">
          {link.estado === "invalidado"
            ? "Otra persona pagó estas fechas primero. Tu tarjeta no fue cobrada."
            : "Este link venció. Tu tarjeta no fue cobrada."}{" "}
          Contacta a tu asesor para buscar nuevas fechas u otra propiedad.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <AnimatePresence mode="wait">
        {fase !== "pagado" ? (
          <motion.div
            key="form"
            exit={{ opacity: 0, y: -16 }}
            className="rounded-3xl border border-borde bg-tarjeta p-8"
          >
            <div className="border-b border-borde pb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bruma-osc">
                Tu reserva
              </p>
              <h1 className="mt-1 font-display text-2xl text-tinta">{link.propiedadNombre}</h1>
              <p className="mt-1 text-sm text-bruma">
                {link.fechas.desde} → {link.fechas.hasta}
              </p>
            </div>
            <div className="flex items-center justify-between py-5">
              <div>
                <p className="text-sm text-bruma">
                  {link.mitad === 1 ? "Anticipo para reservar (50%)" : "Saldo — día de ingreso (50%)"}
                </p>
                <p className="text-[11px] text-bruma-osc">Link válido hasta {link.vence}</p>
              </div>
              <Money valor={link.monto} className="text-2xl font-bold text-tinta" />
            </div>
            <div className="space-y-3">
              <input
                placeholder="Número de tarjeta"
                className="w-full rounded-xl border border-borde bg-panel px-4 py-3 text-sm text-tinta placeholder:text-bruma-osc"
              />
              <div className="flex gap-3">
                <input placeholder="MM/AA" className="w-1/2 rounded-xl border border-borde bg-panel px-4 py-3 text-sm placeholder:text-bruma-osc" />
                <input placeholder="CVC" className="w-1/2 rounded-xl border border-borde bg-panel px-4 py-3 text-sm placeholder:text-bruma-osc" />
              </div>
              {error && (
                <p className="rounded-lg border border-rojo/30 bg-rojo-tenue p-2 text-[11px] text-rojo">
                  {error}
                </p>
              )}
              <button
                onClick={pagar}
                disabled={fase === "procesando"}
                className="w-full rounded-xl bg-tiffany py-3.5 text-sm font-bold text-tinta transition hover:bg-tiffany-claro disabled:opacity-70"
              >
                {fase === "procesando" ? (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  >
                    Procesando con la pasarela…
                  </motion.span>
                ) : (
                  <>Pagar <Money valor={link.monto} /></>
                )}
              </button>
              <p className="text-center text-[10px] leading-relaxed text-bruma-osc">
                Pago protegido: si alguien paga estas fechas primero, este link se
                invalida en el instante y tu tarjeta no se cobra.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="pagado"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="rounded-3xl border border-esmeralda/30 bg-tarjeta p-8 text-center">
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 13, delay: 0.1 }}
                className="mx-auto flex size-16 items-center justify-center rounded-full bg-esmeralda-tenue text-3xl text-esmeralda"
                style={{ boxShadow: "0 0 50px rgba(10,186,181,0.25)" }}
              >
                ✓
              </motion.div>
              <h1 className="mt-5 font-display text-2xl text-tinta">Pago confirmado</h1>
              <p className="mt-2 text-sm leading-relaxed text-bruma">
                Recibimos tu pago de <Money valor={link.monto} className="font-bold text-tinta" /> por{" "}
                {link.propiedadNombre}. El comprobante va en camino a tu correo y celular.
                {link.mitad === 1 && " Tus fechas quedaron bloqueadas en firme."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
