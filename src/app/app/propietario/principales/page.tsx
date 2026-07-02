"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AvatarAlias, Badge, Card } from "@/components/ui";
import { PROPIEDADES } from "@/lib/data/demo";

/**
 * Gestión de Comisionistas Principales (§2.1): 3–5 por propiedad, por invitación.
 * El propietario los conoce en la vida real; aquí los administra por su alias.
 */

interface Vinculo {
  alias: string;
  reservas: number;
  respuestaMin: number;
}

const VINCULOS_INICIALES: Record<string, Vinculo[]> = {
  "prop-01": [
    { alias: "CONDOR-472", reservas: 21, respuestaMin: 6 },
    { alias: "CEIBA-118", reservas: 12, respuestaMin: 11 },
    { alias: "OCELOTE-903", reservas: 7, respuestaMin: 19 },
    { alias: "HALCON-227", reservas: 3, respuestaMin: 24 },
  ],
  "prop-02": [
    { alias: "CONDOR-472", reservas: 14, respuestaMin: 6 },
    { alias: "CEIBA-118", reservas: 9, respuestaMin: 11 },
    { alias: "PUMA-581", reservas: 4, respuestaMin: 15 },
  ],
};

const MAX = 5;
const MIN = 3;

export default function GestionPrincipales() {
  const [propId, setPropId] = useState("prop-01");
  const [vinculos, setVinculos] = useState(VINCULOS_INICIALES);
  const [invitando, setInvitando] = useState(false);

  const lista = vinculos[propId] ?? [];
  const prop = PROPIEDADES.find((p) => p.id === propId)!;

  const remover = (alias: string) => {
    if (lista.length <= MIN) return;
    setVinculos((v) => ({ ...v, [propId]: (v[propId] ?? []).filter((x) => x.alias !== alias) }));
  };

  const invitar = () => {
    setInvitando(true);
    setTimeout(() => setInvitando(false), 2200);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-tinta">Mis comisionistas principales</h1>
        <p className="mt-1 text-sm text-bruma">
          Tu red de confianza: entre {MIN} y {MAX} por propiedad, vinculados por tu
          invitación. Los administras por su alias — su desempeño habla por ellos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROPIEDADES.slice(0, 2).map((p) => (
          <button
            key={p.id}
            onClick={() => setPropId(p.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              p.id === propId
                ? "border-esmeralda/50 bg-esmeralda-tenue text-esmeralda"
                : "border-borde text-bruma hover:border-borde-claro hover:text-tinta"
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-borde px-6 py-4">
          <div>
            <h2 className="font-display text-lg text-tinta">{prop.nombre}</h2>
            <p className="text-xs text-bruma">
              {lista.length}/{MAX} cupos usados · mínimo {MIN} para operar
            </p>
          </div>
          {lista.length < MAX ? (
            <button
              onClick={invitar}
              disabled={invitando}
              className="rounded-full bg-esmeralda px-5 py-2.5 text-xs font-bold text-fondo transition hover:brightness-110 disabled:opacity-60"
            >
              {invitando ? "Invitación enviada ✓" : "Invitar principal"}
            </button>
          ) : (
            <Badge tono="ambar">Cupo lleno</Badge>
          )}
        </div>

        <div className="divide-y divide-borde">
          <AnimatePresence>
            {lista.map((v) => (
              <motion.div
                key={v.alias}
                layout
                exit={{ opacity: 0, x: -30 }}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
              >
                <div className="flex items-center gap-3">
                  <AvatarAlias alias={v.alias} size={40} />
                  <div>
                    <p className="font-mono text-sm font-bold text-tinta">{v.alias}</p>
                    <p className="text-[11px] text-bruma">
                      {v.reservas} reservas aquí · responde en ~{v.respuestaMin} min
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {v.respuestaMin <= 10 && <Badge tono="esmeralda">Rápido</Badge>}
                  <button
                    onClick={() => remover(v.alias)}
                    disabled={lista.length <= MIN}
                    className="rounded-full border border-borde px-4 py-2 text-[11px] font-semibold text-bruma transition hover:border-rojo/40 hover:text-rojo disabled:cursor-not-allowed disabled:opacity-40"
                    title={lista.length <= MIN ? `Mínimo ${MIN} principales por propiedad` : "Desvincular"}
                  >
                    Desvincular
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Cupos vacíos */}
          {Array.from({ length: MAX - lista.length }).map((_, i) => (
            <div key={`vacio-${i}`} className="flex items-center gap-3 px-6 py-4 opacity-50">
              <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-borde-claro text-bruma-osc">
                +
              </div>
              <p className="text-xs text-bruma-osc">Cupo disponible — invita a alguien de tu confianza</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 text-[12px] leading-relaxed text-bruma">
        <span className="font-bold text-esmeralda">Cómo funciona la invitación:</span>{" "}
        le envías el código a tu contacto por fuera (a él sí lo conoces), completa su
        KYC, el sistema le asigna su alias y queda vinculado a esta propiedad. Tú
        nunca ves su alias hasta que acepta, y los externos jamás sabrán quién es.
      </Card>
    </div>
  );
}
