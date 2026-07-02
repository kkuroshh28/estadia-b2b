"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

/** Login passwordless: email → código OTP → sesión httpOnly. */
export default function Login() {
  const router = useRouter();
  const [fase, setFase] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const pedirCodigo = async () => {
    setCargando(true);
    setError(null);
    const res = await fetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setCargando(false);
    if (res.ok) setFase("codigo");
    else setError((await res.json()).error ?? "No fue posible enviar el código.");
  };

  const entrar = async () => {
    setCargando(true);
    setError(null);
    const res = await fetch("/api/auth/sesion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, codigo }),
    });
    setCargando(false);
    if (res.ok) router.push("/app");
    else setError((await res.json()).error ?? "Código inválido.");
  };

  return (
    <main className="atmosfera flex min-h-screen flex-col items-center justify-center px-6">
      <Link href="/" className="font-display text-2xl text-tinta">
        ESTADÍA<span className="text-esmeralda">.</span>
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 w-full max-w-sm rounded-3xl border border-borde bg-tarjeta p-8"
      >
        <h1 className="font-display text-2xl text-tinta">
          {fase === "email" ? "Entrar" : "Revisa tu correo"}
        </h1>
        <p className="mt-1 text-xs text-bruma">
          {fase === "email"
            ? "Te enviamos un código de un solo uso. Sin contraseñas."
            : `Código de 6 dígitos enviado a ${email}. Vence en 10 minutos.`}
        </p>

        {fase === "email" ? (
          <>
            <label className="mt-6 block text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
              Correo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pedirCodigo()}
              placeholder="tu@correo.com"
              className="mt-1.5 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-sm text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50"
            />
            <button
              onClick={pedirCodigo}
              disabled={cargando || !email.includes("@")}
              className="mt-5 w-full rounded-full bg-esmeralda py-3.5 text-sm font-bold text-fondo transition hover:brightness-110 disabled:opacity-50"
            >
              {cargando ? "Enviando…" : "Enviar código"}
            </button>
          </>
        ) : (
          <>
            <label className="mt-6 block text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
              Código
            </label>
            <input
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && entrar()}
              placeholder="000000"
              className="cifra mt-1.5 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-center text-2xl tracking-[0.4em] text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50"
            />
            <button
              onClick={entrar}
              disabled={cargando || codigo.length !== 6}
              className="mt-5 w-full rounded-full bg-esmeralda py-3.5 text-sm font-bold text-fondo transition hover:brightness-110 disabled:opacity-50"
            >
              {cargando ? "Verificando…" : "Entrar"}
            </button>
            <button
              onClick={() => setFase("email")}
              className="mt-3 w-full text-center text-xs text-bruma hover:text-tinta"
            >
              Usar otro correo
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-rojo/30 bg-rojo-tenue p-2.5 text-[11px] text-rojo">
            {error}
          </p>
        )}
      </motion.div>
      <p className="mt-5 text-xs text-bruma-osc">
        ¿Sin cuenta?{" "}
        <Link href="/registro" className="font-semibold text-esmeralda hover:underline">
          Regístrate
        </Link>
      </p>
    </main>
  );
}
