"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AvatarAlias, Badge, Card } from "@/components/ui";
import type { DatosPrincipales, VinculoPanel } from "@/lib/domain/paneles";

/**
 * Gestión de Comisionistas Principales (§2.1): 3–5 por propiedad, por invitación.
 * El propietario los conoce en la vida real; aquí los administra por su alias.
 */

const MAX = 5;
const MIN = 3;

export function PrincipalesCliente({ datos }: { datos: DatosPrincipales }) {
  const router = useRouter();
  const [propId, setPropId] = useState(datos.propiedades[0]?.id ?? "");
  const [vinculos, setVinculos] = useState<Record<string, VinculoPanel[]>>(datos.vinculos);
  const [base, setBase] = useState(datos.vinculos);
  const [aliasNuevo, setAliasNuevo] = useState("");
  const [invitando, setInvitando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tras un refresh del servidor, el estado local se realinea.
  if (base !== datos.vinculos) {
    setBase(datos.vinculos);
    setVinculos(datos.vinculos);
  }

  const lista = vinculos[propId] ?? [];
  const prop = datos.propiedades.find((p) => p.id === propId);

  const llamarVinculos = async (alias: string, accion: "vincular" | "desvincular") => {
    setError(null);
    const r = await fetch("/api/propiedades/vinculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propiedadId: propId, alias, accion }),
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error ?? "No se pudo actualizar el vínculo");
    router.refresh();
  };

  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-3xl text-tinta">Mis comisionistas principales</h1>
        <Card className="p-8 text-sm text-bruma">
          Registra tu primera propiedad para invitar a tu red de confianza (entre{" "}
          {MIN} y {MAX} principales por propiedad).
        </Card>
      </div>
    );
  }

  const remover = async (alias: string) => {
    if (datos.esDemo) {
      setVinculos((v) => ({ ...v, [propId]: (v[propId] ?? []).filter((x) => x.alias !== alias) }));
      return;
    }
    try {
      await llamarVinculos(alias, "desvincular");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desvincular");
    }
  };

  const invitar = async () => {
    if (datos.esDemo) {
      setInvitando(true);
      setTimeout(() => setInvitando(false), 2200);
      return;
    }
    if (!aliasNuevo.trim()) {
      setError("Escribe el alias del principal (te lo comparte él).");
      return;
    }
    setInvitando(true);
    try {
      await llamarVinculos(aliasNuevo, "vincular");
      setAliasNuevo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo vincular");
    } finally {
      setInvitando(false);
    }
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
        {datos.propiedades.map((p) => (
          <button
            key={p.id}
            onClick={() => setPropId(p.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              p.id === propId
                ? "border-tiffany bg-tiffany-bruma text-tinta"
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
            datos.esDemo ? (
              <button
                onClick={invitar}
                disabled={invitando}
                className="rounded-full bg-tiffany px-5 py-2.5 text-xs font-bold text-tinta transition hover:bg-tiffany-claro disabled:opacity-60"
              >
                {invitando ? "Invitación enviada ✓" : "Invitar principal"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={aliasNuevo}
                  onChange={(e) => setAliasNuevo(e.target.value.toUpperCase())}
                  placeholder="ALIAS-000"
                  className="w-36 rounded-full border border-borde bg-panel px-4 py-2.5 font-mono text-xs text-tinta placeholder:text-bruma-osc"
                />
                <button
                  onClick={invitar}
                  disabled={invitando}
                  className="rounded-full bg-tiffany px-5 py-2.5 text-xs font-bold text-tinta transition hover:bg-tiffany-claro disabled:opacity-60"
                >
                  {invitando ? "Vinculando…" : "Vincular"}
                </button>
              </div>
            )
          ) : (
            <Badge tono="ambar">Cupo lleno</Badge>
          )}
        </div>

        {error && (
          <p className="border-b border-borde px-6 py-3 text-[11px] text-rojo">{error}</p>
        )}
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
                      {v.reservas} reservas aquí
                      {v.respuestaMin !== null && ` · responde en ~${v.respuestaMin} min`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {v.respuestaMin !== null && v.respuestaMin <= 10 && (
                    <Badge tono="esmeralda">Rápido</Badge>
                  )}
                  <button
                    onClick={() => remover(v.alias)}
                    disabled={datos.esDemo && lista.length <= MIN}
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
          {Array.from({ length: Math.max(0, MAX - lista.length) }).map((_, i) => (
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
