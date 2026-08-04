"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Intro cinematográfico de entrada (Medellín → Guatapé → mansiones → logo).
 *
 * Rendimiento y robustez:
 *  - El navegador elige la fuente por media query en los <source>: móvil carga
 *    el MP4 de 720p (~2,5 MB) y PC/tablet el de 1080p — el teléfono nunca baja
 *    el archivo pesado, así arranca instantáneo y no se traba.
 *  - `muted` + `playsInline` + `autoPlay`: única forma de que el navegador móvil
 *    reproduzca sin gesto. `preload="auto"` para que fluya sin cortes.
 *  - Poster instantáneo: primera pintura inmediata mientras el video carga.
 *  - Se ve UNA vez por sesión (sessionStorage); reduced-motion lo omite.
 *  - Salir: al terminar, con "Saltar", tocando la pantalla, o por timeout/fallo
 *    de autoplay — jamás deja al usuario atrapado.
 */
export function IntroGate() {
  // Arranca visible (SSR + cliente) para cubrir el hero sin parpadeo.
  const [fase, setFase] = useState<"activo" | "saliendo" | "oculto">("activo");
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

  useEffect(() => {
    // Ya visto en esta sesión, o el usuario prefiere menos movimiento → fuera.
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

    // Red de seguridad: si algo falla, cerrar a los 11 s pase lo que pase.
    const tope = window.setTimeout(cerrar, 11_000);

    // Intentar reproducir; si el navegador rechaza el autoplay, cerrar sin trabar.
    const intento = videoRef.current?.play?.();
    if (intento && typeof intento.catch === "function") {
      intento.catch(() => cerrar());
    }

    return () => window.clearTimeout(tope);
  }, []);

  // Bloqueo de scroll atado a la fase: al cerrar (fase ≠ activo) SIEMPRE se
  // restaura, aunque el componente siga montado devolviendo null.
  useEffect(() => {
    if (fase !== "activo") return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [fase]);

  if (fase === "oculto") return null;

  return (
    <>
      {/* Sin JavaScript el video no se puede cerrar → se oculta por completo. */}
      <noscript>
        <style>{`.circle-intro-overlay{display:none!important}`}</style>
      </noscript>
      <div
        className="circle-intro-overlay"
        aria-hidden
        onClick={cerrar}
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
          onEnded={cerrar}
          onError={cerrar}
          disablePictureInPicture
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        >
          {/* Móvil primero (media query); PC/tablet cae al 1080p. */}
          <source src="/intro/circle-intro-720.mp4" media="(max-width: 820px)" type="video/mp4" />
          <source src="/intro/circle-intro-1080.mp4" type="video/mp4" />
        </video>
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
