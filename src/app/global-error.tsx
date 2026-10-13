"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Último recurso: error en el layout raíz. Reemplaza al layout, por eso define
 * <html>/<body> propios y usa estilos en línea (no depende de fuentes ni del shell).
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "24px",
          textAlign: "center",
          background: "#101b16",
          color: "#f1ebdd",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <title>Algo salió mal · THE CIRCLE</title>
        <p style={{ letterSpacing: "0.3em", color: "#c9a46b", fontWeight: 700, margin: 0 }}>THE CIRCLE</p>
        <h1 style={{ fontSize: "26px", margin: "8px 0 0" }}>Algo salió mal de nuestro lado</h1>
        <p style={{ maxWidth: "380px", fontSize: "14px", lineHeight: 1.6, color: "#a7b8ab", margin: 0 }}>
          El error quedó registrado. Ningún pago se procesa dos veces: si estabas
          pagando, revisa el estado del link antes de reintentar.
        </p>
        {error.digest && (
          <p style={{ fontSize: "11px", color: "#8b9d90", margin: 0 }}>ref: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            marginTop: "16px",
            minHeight: "44px",
            padding: "10px 24px",
            borderRadius: "9999px",
            border: 0,
            background: "#c9a46b",
            color: "#101b16",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
