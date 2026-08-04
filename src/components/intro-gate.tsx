"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Intro cinematográfico de entrada (Medellín → Guatapé → mansiones → logo).
 *
 * Rendimiento y robustez:
 *  - Móvil (≤820px) recibe el MP4 de 720p (~2,5 MB); PC/tablet el de 1080p. La
 *    fuente se asigna por JS (imperativa) — así el teléfono nunca baja el pesado
 *    y evitamos el bug de <source media> en Safari iOS.
 *  - `muted` se fuerza EN EL DOM (videoRef.muted = true) antes de reproducir:
 *    React no refleja de forma fiable ese atributo y sin él el móvil bloquea el
 *    autoplay. Con eso + playsInline el video arranca solo en el teléfono.
 *  - Si aun así el navegador bloquea el autoplay (p. ej. modo ahorro de iOS),
 *    NO se salta: se muestra el póster con "Toca para reproducir" y un tap lo
 *    inicia (el gesto del usuario desbloquea la reproducción).
 *  - Poster instantáneo; una vez por sesión; respeta reduced-motion; salta con
 *    el botón o tocando mientras corre; backstop de 12 s; scroll restaurado.
 */
const FUENTE_MOVIL = "/intro/circle-intro-720.mp4";
const FUENTE_PC = "/intro/circle-intro-1080.mp4";

export function IntroGate() {
  const [fase, setFase] = useState<"activo" | "saliendo" | "oculto">("activo");
  const [necesitaTap, setNecesitaTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cerrado = useRef(false);

  const cerrar = () => {
    if (cerrado.current) return;
    cerrado.current = true;
    try {
      sessionStorage.setItem("circle-intro-visto", "1");
    } catch {}
    setFase("saliendo");
    window.setTimeout(() => setFase("oculto"), 650);
  };

  const reproducir = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true; // imperativo: clave para el autoplay en móvil
    const p = v.play();
    if (p && typeof p.catch === "function") {
      // Autoplay bloqueado → mostrar póster + "Toca para reproducir" (no saltar).
      p.then(() => setNecesitaTap(false)).catch(() => setNecesitaTap(true));
    }
  };

  useEffect(() => {
    let visto = false;
    try {
      visto = sessionStorage.getItem("circle-intro-visto") === "1";
    } catch {}
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (visto || reduce) {
      cerrado.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFase("oculto");
      return;
    }

    const v = videoRef.current;
    if (v) {
      const movil = window.matchMedia("(max-width: 820px)").matches;
      v.muted = true;
      v.src = movil ? FUENTE_MOVIL : FUENTE_PC;
      v.load();
    }
    reproducir();

    // Backstop: si nunca llegó a reproducir y el usuario no toca, continuar a
    // los 12 s (jamás lo deja atrapado en el póster).
    const tope = window.setTimeout(cerrar, 12_000);
    return () => window.clearTimeout(tope);
  }, []);

  // Bloqueo de scroll atado a la fase: al cerrar SIEMPRE se restaura.
  useEffect(() => {
    if (fase !== "activo") return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [fase]);

  if (fase === "oculto") return null;

  const alTocar = () => {
    if (necesitaTap) reproducir(); // un tap desbloquea la reproducción
    else cerrar(); // tocar mientras corre = saltar
  };

  return (
    <>
      <noscript>
        <style>{`.circle-intro-overlay{display:none!important}`}</style>
      </noscript>
      <div
        className="circle-intro-overlay"
        aria-hidden
        onClick={alTocar}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "#0d1712",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          opacity: fase === "saliendo" ? 0 : 1,
          transition: "opacity 0.6s ease",
        }}
      >
        <video
          ref={videoRef}
          poster="/intro/circle-poster.jpg"
          muted
          autoPlay
          playsInline
          preload="auto"
          controls={false}
          onPlaying={() => setNecesitaTap(false)}
          onEnded={cerrar}
          onError={cerrar}
          disablePictureInPicture
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        {necesitaTap && (
          <div
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
