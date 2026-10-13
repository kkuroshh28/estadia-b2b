"use client";

import { useEffect, useRef, useState } from "react";
import { CLAVE_INTRO_VISTO, VIGENCIA_INTRO_MS } from "@/lib/intro";

/**
 * Intro cinematográfico de entrada (Medellín → Guatapé → mansiones → logo).
 *
 * Rendimiento y adaptación por dispositivo:
 *  - PC/tablet: video 1080p a pantalla completa (objectFit cover).
 *  - Teléfono en VERTICAL: el video 16:9 NO se recorta (objectFit contain) para
 *    que se vea COMPLETO; el vacío arriba/abajo se llena con una copia
 *    DESENFOCADA del propio póster → llena la pantalla y queda cinematográfico,
 *    sin barras negras ni "zoom" a los lados.
 *  - Teléfono en horizontal: 720p a pantalla completa.
 *  - Fuente/objectFit/póster se asignan por JS imperativo (no <source media>,
 *    que falla en Safari iOS) y `muted` se fuerza en el DOM (sin eso el móvil
 *    bloquea el autoplay). Si aun así se bloquea, se muestra "Toca para
 *    reproducir" en vez de saltarlo.
 *  - Se muestra una vez cada 7 días (localStorage). Un script inline temprano
 *    del layout raíz marca <html data-intro-visto> ANTES del primer paint y el
 *    CSS oculta el overlay → quien ya lo vio no ve ni un destello.
 *  - Respeta reduced-motion; backstop 12 s; scroll restaurado.
 *  - Accesible: role="dialog", foco inicial en "Saltar", Esc cierra.
 */
const FUENTE_MOVIL = "/intro/circle-intro-720.mp4"; // 16:9 liviano (teléfono)
const FUENTE_PC = "/intro/circle-intro-1080.mp4"; // 16:9 (PC/tablet)
const POSTER = "/intro/circle-poster.jpg";


function introVistoReciente(): boolean {
  try {
    const t = Number(localStorage.getItem(CLAVE_INTRO_VISTO));
    return t > 0 && Date.now() - t < VIGENCIA_INTRO_MS;
  } catch {
    return false;
  }
}

export function IntroGate() {
  const [fase, setFase] = useState<"activo" | "saliendo" | "oculto">("activo");
  const [necesitaTap, setNecesitaTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fondoRef = useRef<HTMLDivElement>(null);
  const saltarRef = useRef<HTMLButtonElement>(null);
  const cerrado = useRef(false);

  const cerrar = () => {
    if (cerrado.current) return;
    cerrado.current = true;
    try {
      localStorage.setItem(CLAVE_INTRO_VISTO, String(Date.now()));
    } catch {}
    document.documentElement.setAttribute("data-intro-visto", "");
    setFase("saliendo");
    window.setTimeout(() => setFase("oculto"), 650);
  };

  const reproducir = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true; // imperativo: clave para el autoplay en móvil
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.then(() => setNecesitaTap(false)).catch(() => setNecesitaTap(true));
    }
  };

  useEffect(() => {
    const visto =
      document.documentElement.hasAttribute("data-intro-visto") || introVistoReciente();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (visto || reduce) {
      cerrado.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFase("oculto");
      return;
    }

    const v = videoRef.current;
    const fondo = fondoRef.current;
    if (v) {
      const telefono = window.matchMedia("(max-width: 820px)").matches;
      const vertical = window.matchMedia("(orientation: portrait)").matches;
      v.muted = true;
      v.src = telefono ? FUENTE_MOVIL : FUENTE_PC;
      if (telefono && vertical) {
        // Cuadro completo (sin recorte) + fondo desenfocado que llena la pantalla.
        v.style.objectFit = "contain";
        if (fondo) fondo.style.display = "block";
      } else {
        v.style.objectFit = "cover";
        if (fondo) fondo.style.display = "none";
      }
      v.load();
    }
    reproducir();
    saltarRef.current?.focus();

    const tope = window.setTimeout(cerrar, 12_000);
    return () => window.clearTimeout(tope);
  }, []);

  useEffect(() => {
    if (fase !== "activo") return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("keydown", alTeclear);
    };
  }, [fase]);

  if (fase === "oculto") return null;

  const alTocar = () => {
    if (necesitaTap) reproducir();
    else cerrar();
  };

  return (
    <>
      <noscript>
        <style>{`.circle-intro-overlay{display:none!important}`}</style>
      </noscript>
      <div
        className="circle-intro-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Intro de THE CIRCLE"
        onClick={alTocar}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "#0d1712",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          cursor: "pointer",
          opacity: fase === "saliendo" ? 0 : 1,
          transition: "opacity 0.6s ease",
        }}
      >
        {/* Fondo desenfocado (solo teléfono vertical): llena el alto sin barras. */}
        <div
          ref={fondoRef}
          aria-hidden
          style={{
            display: "none",
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${POSTER})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(32px) brightness(0.45)",
            transform: "scale(1.15)",
          }}
        />
        <video
          ref={videoRef}
          aria-hidden
          poster={POSTER}
          muted
          autoPlay
          playsInline
          preload="metadata"
          controls={false}
          onPlaying={() => setNecesitaTap(false)}
          onEnded={cerrar}
          onError={cerrar}
          disablePictureInPicture
          style={{ position: "relative", width: "100%", height: "100%", objectFit: "cover" }}
        />

        {necesitaTap && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              pointerEvents: "none",
              color: "#e6c78a",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "72px",
                height: "72px",
                borderRadius: "9999px",
                border: "1.5px solid rgba(201,164,107,0.7)",
                background: "rgba(13,23,18,0.4)",
                fontSize: "26px",
                paddingLeft: "6px",
              }}
            >
              ▶
            </span>
            <span
              style={{
                font: "600 13px/1 var(--font-bricolage), sans-serif",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Toca para reproducir
            </span>
          </div>
        )}

        <button
          ref={saltarRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cerrar();
          }}
          style={{
            position: "absolute",
            bottom: "clamp(20px, 5vw, 40px)",
            right: "clamp(20px, 5vw, 40px)",
            padding: "10px 20px",
            borderRadius: "9999px",
            border: "1px solid rgba(201,164,107,0.5)",
            background: "rgba(13,23,18,0.55)",
            color: "#e6c78a",
            font: "600 13px/1 var(--font-bricolage), sans-serif",
            letterSpacing: "0.08em",
            backdropFilter: "blur(6px)",
            cursor: "pointer",
          }}
        >
          Saltar intro ✕
        </button>
      </div>
    </>
  );
}
