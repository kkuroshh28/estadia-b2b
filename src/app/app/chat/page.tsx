"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AvatarAlias, Badge, Card } from "@/components/ui";
import { filtrarMensaje } from "@/lib/domain/antifuga";

/**
 * Chat interno por reserva (§7): entre alias, con filtro anti-fuga PRE-envío.
 * Escribe un teléfono, correo o @usuario y míralo bloquearse en vivo.
 * 3 intentos = ban perpetuo a la identidad (demo).
 */

interface Mensaje {
  id: number;
  emisor: "yo" | "el" | "sistema";
  texto: string;
  bloqueado?: boolean;
  motivos?: string[];
}

const INICIALES: Mensaje[] = [
  { id: 1, emisor: "el", texto: "Buenas. Mi cliente llega el 17 a las 3 pm, ¿la entrega es en portería?" },
  { id: 2, emisor: "yo", texto: "Sí, en portería con el código QR que genera la app cuando el semáforo esté en verde." },
  { id: 3, emisor: "el", texto: "Perfecto. Ya le reenvié el link del saldo, apenas pague coordinamos." },
];

const MAX_STRIKES = 3;

export default function ChatInterno() {
  const [mensajes, setMensajes] = useState<Mensaje[]>(INICIALES);
  const [texto, setTexto] = useState("");
  const [strikes, setStrikes] = useState(0);
  const [baneado, setBaneado] = useState(false);
  const siguienteId = useRef(10);

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio || baneado) return;
    const filtro = filtrarMensaje(limpio);
    const id = siguienteId.current++;

    if (filtro.bloqueado) {
      const nuevos = strikes + 1;
      setStrikes(nuevos);
      setMensajes((m) => [
        ...m,
        { id, emisor: "yo", texto: limpio, bloqueado: true, motivos: filtro.motivos },
      ]);
      if (nuevos >= MAX_STRIKES) setBaneado(true);
    } else {
      setMensajes((m) => [...m, { id, emisor: "yo", texto: limpio }]);
    }
    setTexto("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-tinta">Chat interno</h1>
          <p className="mt-1 text-sm text-bruma">
            Reserva EST-2026-00362 · Finca Mirador del Peñol · entre alias, filtro
            anti-fuga activo antes del envío.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AvatarAlias alias="COLIBRI-345" size={30} />
          <span className="font-mono text-xs text-bruma">COLIBRI-345</span>
          <span className="text-bruma-osc">·</span>
          <AvatarAlias alias="CONDOR-472" size={30} />
          <span className="font-mono text-xs text-oro">CONDOR-472 (tú)</span>
        </div>
      </div>

      {/* Contador de strikes */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <motion.span
              key={i}
              animate={{ scale: i < strikes ? [1, 1.35, 1] : 1 }}
              className={`size-2.5 rounded-full ${i < strikes ? "bg-rojo" : "bg-borde-claro"}`}
            />
          ))}
        </div>
        <p className="text-[11px] text-bruma-osc">
          {strikes === 0
            ? "Sin intentos de fuga registrados"
            : `${strikes}/${MAX_STRIKES} intentos registrados como evidencia`}
        </p>
      </div>

      {/* HILO */}
      <Card className="relative flex h-[26rem] flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {mensajes.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className={`flex ${m.emisor === "yo" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl border px-4 py-3 text-sm ${
                  m.bloqueado
                    ? "rounded-tr-sm border-rojo/40 bg-rojo-tenue"
                    : m.emisor === "yo"
                      ? "rounded-tr-sm border-esmeralda/25 bg-esmeralda-tenue text-tinta"
                      : "rounded-tl-sm border-borde bg-panel text-bruma"
                }`}
              >
                {m.bloqueado ? (
                  <>
                    <p className="text-bruma line-through">{m.texto}</p>
                    <p className="mt-2 text-xs font-bold text-rojo">⛔ Bloqueado antes del envío</p>
                    <p className="mt-1 text-[11px] text-bruma">
                      Detectado: {m.motivos?.join(" · ")}. {MAX_STRIKES - strikes > 0 ? `Este intento quedó registrado.` : ""}
                    </p>
                  </>
                ) : (
                  m.texto
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* INPUT */}
        <div className="border-t border-borde bg-panel p-4">
          <div className="flex gap-3">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              disabled={baneado}
              placeholder={baneado ? "Cuenta suspendida" : 'Prueba escribir "mi número es 310 555 1234"…'}
              className="flex-1 rounded-full border border-borde bg-tarjeta px-5 py-3 text-sm text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50 disabled:opacity-40"
            />
            <button
              onClick={enviar}
              disabled={baneado}
              className="rounded-full bg-esmeralda px-6 text-sm font-bold text-fondo transition hover:brightness-110 disabled:opacity-40"
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
                cuenta. El alias <span className="font-mono text-oro">CONDOR-472</span>{" "}
                queda retirado para siempre junto con toda su reputación.
              </p>
              <p className="mt-4 text-[11px] text-bruma-osc">Sin negociación. Sin apelación. Así se protege el gremio.</p>
              <button
                onClick={() => { setBaneado(false); setStrikes(0); }}
                className="mt-6 rounded-full border border-borde-claro px-6 py-2.5 text-xs font-semibold text-bruma transition hover:text-tinta"
              >
                Reiniciar demo
              </button>
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
