"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AvatarAlias, Badge, Card, Money } from "@/components/ui";
import { MoneyAnimado } from "@/components/motion";
import { DesgloseSplit } from "@/components/desglose";
import { calcularSplit, validarPropuesta } from "@/lib/domain/split";
import type { Oferta } from "@/lib/domain/tipos";
import type { DatosNegociacion, NegociacionPanel } from "@/lib/domain/paneles";

/**
 * Módulo de negociación (§4.2) — formal, interno y obligatorio.
 * Oferta → contraoferta → aceptación, con desglose en vivo para ambos.
 * El precio aceptado genera el link de pago automáticamente:
 * imposible digitarlo distinto.
 */
export function NegociacionCliente({ datos }: { datos: DatosNegociacion }) {
  const neg = datos.negociacion as NegociacionPanel; // el server garantiza != null

  const [perspectiva, setPerspectiva] = useState<"principal" | "externo">(
    datos.perspectivaFija ?? "principal",
  );
  const [ofertas, setOfertas] = useState<Oferta[]>(neg.ofertas);
  const [propuesta, setPropuesta] = useState(neg.tarifaNetaTotal + Math.round((neg.rangoSugerido.min - neg.tarifaNetaTotal) * 1.2));
  const [acordado, setAcordado] = useState<number | null>(null);

  const ultima = ofertas[ofertas.length - 1];
  const turnoDe = ultima.emisor === "principal" ? "externo" : "principal";
  const esMiTurno = perspectiva === turnoDe && !acordado;
  const validacion = validarPropuesta(propuesta, neg.tarifaNetaTotal);
  const alias = perspectiva === "principal" ? neg.aliasPrincipal : neg.aliasExterno;

  const contraofertar = () => {
    if (!validacion.valida) return;
    setOfertas((prev) => [
      ...prev.map((o) => ({ ...o, estado: "contraofertada" as const })),
      {
        id: `of-${prev.length + 1}`,
        emisor: perspectiva,
        monto: propuesta,
        timestamp: "ahora",
        vigenciaHoras: 6,
        estado: "activa",
      },
    ]);
  };

  const aceptar = () => setAcordado(ultima.monto);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-tinta">Módulo de negociación</h1>
          <p className="mt-1 text-sm text-bruma">
            {neg.propiedadNombre} · {neg.fechas.desde} → {neg.fechas.hasta} · {neg.noches} noches
          </p>
        </div>
        {/* Selector de perspectiva (solo demo) */}
        {datos.perspectivaFija === null && (
        <div className="flex rounded-full border border-borde bg-panel p-1 text-xs font-semibold">
          {(["principal", "externo"] as const).map((rol) => (
            <button
              key={rol}
              onClick={() => setPerspectiva(rol)}
              className={`rounded-full px-4 py-2 transition ${
                perspectiva === rol ? "bg-tiffany-bruma text-tinta" : "text-bruma"
              }`}
            >
              Ver como {rol === "principal" ? neg.aliasPrincipal : neg.aliasExterno}
            </button>
          ))}
        </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-bruma-osc">Tarifa neta total (intocable)</p>
          <Money valor={neg.tarifaNetaTotal} className="mt-1 block text-xl font-bold text-esmeralda" />
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-bruma-osc">Mercado · fechas similares</p>
          <p className="cifra mt-1 text-xl font-bold text-tinta">
            <Money valor={neg.rangoSugerido.min} /> – <Money valor={neg.rangoSugerido.max} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-bruma-osc">Estado</p>
          <div className="mt-1.5">
            {acordado ? (
              <Badge tono="esmeralda">Precio acordado</Badge>
            ) : (
              <Badge tono="ambar" vivo>Negociación abierta · vigencia 6 h</Badge>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* HILO DE OFERTAS */}
        <Card className="p-6 lg:col-span-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bruma-osc">
            Registro inmutable · cero &ldquo;tú me dijiste otra cosa&rdquo;
          </p>
          <div className="mt-4 space-y-4">
            {ofertas.map((o) => {
              const esMia = o.emisor === perspectiva;
              const aliasEmisor = o.emisor === "principal" ? neg.aliasPrincipal : neg.aliasExterno;
              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className={`flex gap-3 ${esMia ? "flex-row-reverse" : ""}`}
                >
                  <AvatarAlias alias={aliasEmisor} size={34} />
                  <div
                    className={`max-w-[75%] rounded-2xl border px-4 py-3 ${
                      esMia
                        ? "rounded-tr-sm border-tiffany-claro bg-tiffany-bruma"
                        : "rounded-tl-sm border-borde bg-panel"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <p className="font-mono text-[11px] font-bold text-bruma">{aliasEmisor}</p>
                      <p className="text-[10px] text-bruma-osc">{o.timestamp} · vigencia {o.vigenciaHoras} h</p>
                    </div>
                    <Money valor={o.monto} className="mt-1 block text-lg font-bold text-tinta" />
                    <p className="text-[11px] text-bruma">
                      comisión implícita{" "}
                      <Money valor={o.monto - neg.tarifaNetaTotal} className="text-oro" />
                    </p>
                  </div>
                </motion.div>
              );
            })}

            <AnimatePresence>
            {acordado && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 20 }}
                className="rounded-2xl border border-esmeralda/35 bg-esmeralda-tenue p-5 text-center"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-esmeralda">
                  Precio acordado por ambos
                </p>
                <Money valor={acordado} className="mt-1 block text-3xl font-bold text-tinta" />
                <p className="mt-2 text-[11px] text-bruma">
                  Link del Pago 1 (<Money valor={Math.round(acordado / 2)} />) generado
                  automáticamente con este monto exacto. Las fechas siguen libres
                  hasta que el cliente pague.
                </p>
                <Link
                  href="/pago/lnk-7f3a"
                  className="mt-4 inline-block rounded-full bg-tiffany px-6 py-2.5 text-xs font-bold text-tinta transition hover:bg-tiffany-claro"
                >
                  Ver checkout del cliente →
                </Link>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </Card>

        {/* PANEL DE ACCIÓN */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-bruma-osc">
              Actúas como
            </p>
            <div className="mt-2 flex items-center gap-2">
              <AvatarAlias alias={alias} size={30} />
              <p className="font-mono text-sm font-bold text-tinta">{alias}</p>
            </div>

            {acordado ? (
              <p className="mt-4 text-sm text-bruma">
                Negociación cerrada en <Money valor={acordado} className="font-bold text-esmeralda" />.
              </p>
            ) : esMiTurno ? (
              <>
                <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
                  Tu contraoferta
                </label>
                <input
                  type="range"
                  min={neg.tarifaNetaTotal}
                  max={neg.tarifaNetaTotal + 1_600_000}
                  step={10_000}
                  value={propuesta}
                  onChange={(e) => setPropuesta(Number(e.target.value))}
                  className="mt-3 w-full accent-oro"
                />
                <MoneyAnimado valor={propuesta} className="mt-1 block text-center text-2xl font-bold text-tinta" />
                {!validacion.valida && (
                  <p className="mt-2 rounded-lg border border-rojo/30 bg-rojo-tenue p-2 text-[11px] text-rojo">
                    {validacion.motivo}
                  </p>
                )}
                <div className="mt-4 grid gap-2">
                  <button
                    onClick={aceptar}
                    className="rounded-full bg-tiffany px-5 py-3 text-xs font-bold text-tinta transition hover:bg-tiffany-claro"
                  >
                    Aceptar la última oferta (<Money valor={ultima.monto} />)
                  </button>
                  <button
                    onClick={contraofertar}
                    disabled={!validacion.valida}
                    className="rounded-full border border-oro/50 bg-oro-tenue px-5 py-3 text-xs font-bold text-oro transition hover:bg-oro hover:text-fondo disabled:opacity-40"
                  >
                    Enviar contraoferta
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-4 rounded-xl border border-borde bg-panel p-3 text-sm text-bruma">
                Es el turno de{" "}
                <span className="font-mono text-xs font-bold text-oro">
                  {turnoDe === "principal" ? neg.aliasPrincipal : neg.aliasExterno}
                </span>
                . Si la vigencia expira sin respuesta, la solicitud expira y las
                fechas siguen libres.
              </p>
            )}
          </Card>

          {/* DESGLOSE EN VIVO */}
          <DesgloseSplit
            precioFinal={acordado ?? (esMiTurno ? propuesta : ultima.monto)}
            tarifaNeta={neg.tarifaNetaTotal}
            perspectiva={perspectiva}
          />

          {(() => {
            const precio = acordado ?? (esMiTurno ? propuesta : ultima.monto);
            const { porMitad } = calcularSplit(precio, neg.tarifaNetaTotal);
            return (
              <Card className="p-4 text-[11px] leading-relaxed text-bruma">
                Cada mitad del pago (<Money valor={porMitad.precioFinal} className="text-tinta" />)
                dispersa automáticamente:{" "}
                <Money valor={porMitad.principal} className="text-oro" /> al principal,{" "}
                <Money valor={porMitad.externo} className="text-oro" /> al externo,{" "}
                <Money valor={porMitad.app} className="text-bruma" /> a la plataforma y{" "}
                <Money valor={porMitad.tarifaNeta} className="text-esmeralda" /> al
                propietario. Sin retenciones.
              </Card>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
