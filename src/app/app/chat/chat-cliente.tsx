"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AvatarAlias, Badge, Card } from "@/components/ui";
import type { DatosChat, MensajeChatPanel } from "@/lib/domain/paneles";

/**
 * Chat interno por reserva (§7): entre alias, con filtro anti-fuga.
 * Con DB: mensajes PERSISTENTES, strikes reales y ban a la identidad al 3º
 * (procesarMensaje en servidor). Un mensaje bloqueado JAMÁS se entrega: solo
 * su emisor lo ve, tachado y con el motivo.
 */

const MAX_STRIKES = 3;

export function ChatCliente({ datos }: { datos: DatosChat }) {
  const [perspectiva, setPerspectiva] = useState<"principal" | "externo">("principal");
  const [mensajes, setMensajes] = useState<MensajeChatPanel[]>(datos.mensajes);
  const [base, setBase] = useState(datos.mensajes);
  const [texto, setTexto] = useState("");
  const [strikes, setStrikes] = useState(datos.strikes);
  const [baneado, setBaneado] = useState(false);
  const [n, setN] = useState(100);

  if (base !== datos.mensajes) {
    setBase(datos.mensajes);
    setMensajes(datos.mensajes);
  }

  const aliasYo = perspectiva === "principal" ? datos.aliasPrincipal : datos.aliasExterno;
  const aliasEl = perspectiva === "principal" ? datos.aliasExterno : datos.aliasPrincipal;
  const misStrikes = strikes[perspectiva];

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || baneado) return;

    if (!datos.solicitudId) return;

    // Real: el servidor decide, persiste y ejecuta strikes/ban.
    try {
      const res = await fetch("/api/chat/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId: datos.solicitudId, texto: limpio, como: perspectiva }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo enviar");
      const id = `srv-${n}`;
      setN(n + 1);
      if (json.veredicto === "bloqueado") {
        setStrikes((s) => ({ ...s, [perspectiva]: json.strikes }));
        setMensajes((m) => [...m, { id, emisorRol: perspectiva, texto: limpio, bloqueado: true, motivos: json.motivos }]);
        if (json.baneado) setBaneado(true);
      } else {
        setMensajes((m) => [...m, { id, emisorRol: perspectiva, texto: limpio, bloqueado: false, motivos: [] }]);
      }
      setTexto("");
    } catch {
      // el mensaje no se envió; se conserva el texto para reintentar
    }
  };

  // Un bloqueado solo lo ve su emisor: la otra parte jamás lo recibe.
  const visibles = mensajes.filter((m) => !m.bloqueado || m.emisorRol === perspectiva);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-tinta">Chat interno</h1>
          <p className="mt-1 text-sm text-bruma">
            {datos.contexto} · entre alias, filtro anti-fuga activo antes del envío.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AvatarAlias alias={aliasEl} size={30} />
          <span className="font-mono text-xs text-bruma">{aliasEl}</span>
          <span className="text-bruma-osc">·</span>
          <AvatarAlias alias={aliasYo} size={30} />
          <span className="font-mono text-xs text-tinta">{aliasYo} (tú)</span>
        </div>
      </div>

      {/* Perspectiva (demo / dev sin sesión) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_STRIKES }).map((_, i) => (
              <motion.span
                key={i}
                animate={{ scale: i < misStrikes ? [1, 1.35, 1] : 1 }}
                className={`size-2.5 rounded-full ${i < misStrikes ? "bg-rojo" : "bg-borde-claro"}`}
              />
            ))}
          </div>
          <p className="text-[11px] text-bruma-osc">
            {misStrikes === 0
              ? "Sin intentos de fuga registrados"
              : `${misStrikes}/${MAX_STRIKES} intentos registrados como evidencia`}
          </p>
        </div>
        <div className="flex rounded-full border border-borde bg-panel p-1 text-[11px] font-semibold">
          {(["principal", "externo"] as const).map((rol) => (
            <button
              key={rol}
              onClick={() => setPerspectiva(rol)}
              className={`rounded-full px-3 py-1.5 transition ${
                perspectiva === rol ? "bg-tiffany-bruma text-tinta" : "text-bruma"
              }`}
            >
              {rol === "principal" ? datos.aliasPrincipal : datos.aliasExterno}
            </button>
          ))}
        </div>
      </div>

      {/* HILO */}
      <Card className="relative flex h-[26rem] flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {datos.solicitudId === null && (
            <p className="p-4 text-center text-sm text-bruma">
              Sin conversaciones activas. Acepta una solicitud y su hilo aparece aquí.
            </p>
          )}
          {visibles.map((m) => {
            const esMio = m.emisorRol === perspectiva;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className={`flex ${esMio ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl border px-4 py-3 text-sm ${
                    m.bloqueado
                      ? "rounded-tr-sm border-rojo/40 bg-rojo-tenue"
                      : esMio
                        ? "rounded-tr-sm border-tiffany-claro bg-tiffany-bruma text-tinta"
                        : "rounded-tl-sm border-borde bg-panel text-bruma"
                  }`}
                >
                  {m.bloqueado ? (
                    <>
                      <p className="text-bruma line-through">{m.texto}</p>
                      <p className="mt-2 text-xs font-bold text-rojo">⛔ Bloqueado antes del envío</p>
                      <p className="mt-1 text-[11px] text-bruma">
                        Detectado: {m.motivos?.join(" · ")}. Este intento quedó registrado.
                      </p>
                    </>
                  ) : (
                    m.texto
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* INPUT */}
        <div className="border-t border-borde bg-panel p-4">
          <div className="flex gap-3">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              disabled={baneado || !datos.solicitudId}
              placeholder={baneado ? "Cuenta suspendida" : "Escribe tu mensaje…"}
              className="flex-1 rounded-full border border-borde bg-tarjeta px-5 py-3 text-sm text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50 disabled:opacity-40"
            />
            <button
              onClick={enviar}
              disabled={baneado || !datos.solicitudId}
              className="rounded-full bg-tiffany px-6 text-sm font-bold text-tinta transition hover:bg-tiffany-claro disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
          <p className="mt-2 text-[10px] text-bruma-osc">
            El filtro corre ANTES del envío: números (incluso en palabras), correos,
            @usuarios y URLs nunca llegan al otro lado. Las imágenes pasan por OCR.
          </p>
        </div>

        {/* BAN PERPETUO */}
        <AnimatePresence>
          {baneado && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-fondo/95 p-8 text-center backdrop-blur"
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 14 }}
                className="flex size-16 items-center justify-center rounded-full border-2 border-rojo bg-rojo-tenue text-3xl"
              >
                ⛔
              </motion.div>
              <h2 className="mt-5 font-display text-2xl text-rojo">Ban perpetuo aplicado</h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-bruma">
                Tres intentos de intercambiar datos de contacto. Tu cédula y tu
                biometría quedaron en lista negra permanente: no podrás crear otra
                cuenta. El alias <span className="font-mono text-oro">{aliasYo}</span>{" "}
                queda retirado para siempre junto con toda su reputación.
              </p>
              <p className="mt-4 text-[11px] text-bruma-osc">Sin negociación. Sin apelación. Así se protege el gremio.</p>

            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card className="p-4 text-[11px] leading-relaxed text-bruma">
        <Badge tono="esmeralda">Defensa estructural</Badge>
        <p className="mt-2">
          El filtro es la segunda línea. La primera es que fugarse no paga: no sabes
          quién es el otro (anonimato), y adentro tienes calendario confiable, pago
          garantizado, contrato autogenerado y reputación que vale plata.
        </p>
      </Card>
    </div>
  );
}
