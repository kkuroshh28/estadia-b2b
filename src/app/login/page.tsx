"use client";

import { useState } from "react";
import { LogoCircle } from "@/components/logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m } from "motion/react";

const CLASE_LABEL = "block text-[11px] font-bold uppercase tracking-wider text-bruma-osc";
const CLASE_INPUT =
  "mt-1.5 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-sm text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50";
const CLASE_BOTON =
  "mt-5 w-full rounded-full bg-tiffany py-3.5 text-sm font-bold text-noche transition hover:bg-tiffany-claro disabled:opacity-50";

/** Login: contraseña (cuentas que la tienen) o código OTP por correo → sesión httpOnly. */
export default function Login() {
  const router = useRouter();
  const [fase, setFase] = useState<"password" | "email" | "codigo">("password");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  /** Envoltura común: guard de doble envío + try/finally (cargando nunca queda pegado). */
  const enviar = async (url: string, cuerpo: object, porDefecto: string, alExito: () => void) => {
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (res.ok) alExito();
      else setError((await res.json().catch(() => ({}))).error ?? porDefecto);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const entrarConPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || !password) return;
    void enviar("/api/auth/password", { email, password }, "No fue posible entrar.", () =>
      router.push("/app"),
    );
  };

  const pedirCodigo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    void enviar("/api/auth/otp", { email }, "No fue posible enviar el código.", () =>
      setFase("codigo"),
    );
  };

  const entrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.length !== 6) return;
    void enviar("/api/auth/sesion", { email, codigo }, "Código inválido.", () => router.push("/app"));
  };

  return (
    <main className="atmosfera flex min-h-screen flex-col items-center justify-center px-6">
      <Link href="/" className="font-display text-2xl text-tinta">
        <LogoCircle tam={34} />
      </Link>
      {/* Sin opacity inicial: el formulario se ve desde el HTML servido. */}
      <m.div
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        className="mt-8 w-full max-w-sm rounded-3xl border border-borde bg-tarjeta p-8"
      >
        <h1 className="font-display text-2xl text-tinta">
          {fase === "codigo" ? "Revisa tu correo" : "Entrar"}
        </h1>
        <p className="mt-1 text-xs text-bruma">
          {fase === "password"
            ? "Accede con tu correo y contraseña."
            : fase === "email"
              ? "Te enviamos un código de un solo uso."
              : `Código de 6 dígitos enviado a ${email}. Vence en 10 minutos.`}
        </p>

        {fase === "password" ? (
          <form onSubmit={entrarConPassword} noValidate>
            <label htmlFor="login-email" className={`mt-6 ${CLASE_LABEL}`}>
              Correo
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className={CLASE_INPUT}
            />
            <label htmlFor="login-password" className={`mt-4 ${CLASE_LABEL}`}>
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={CLASE_INPUT}
            />
            <button
              type="submit"
              disabled={cargando || !email.includes("@") || !password}
              className={CLASE_BOTON}
            >
              {cargando ? "Verificando…" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => setFase("email")}
              className="mt-3 w-full text-center text-xs text-bruma hover:text-tinta"
            >
              Entrar con código por correo
            </button>
          </form>
        ) : fase === "email" ? (
          <form onSubmit={pedirCodigo} noValidate>
            <label htmlFor="login-email-otp" className={`mt-6 ${CLASE_LABEL}`}>
              Correo
            </label>
            <input
              id="login-email-otp"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className={CLASE_INPUT}
            />
            <button type="submit" disabled={cargando || !email.includes("@")} className={CLASE_BOTON}>
              {cargando ? "Enviando…" : "Enviar código"}
            </button>
            <button
              type="button"
              onClick={() => setFase("password")}
              className="mt-3 w-full text-center text-xs text-bruma hover:text-tinta"
            >
              Entrar con contraseña
            </button>
          </form>
        ) : (
          <form onSubmit={entrar} noValidate>
            <label htmlFor="login-codigo" className={`mt-6 ${CLASE_LABEL}`}>
              Código
            </label>
            <input
              id="login-codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="cifra mt-1.5 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-center text-2xl tracking-[0.4em] text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50"
            />
            <button type="submit" disabled={cargando || codigo.length !== 6} className={CLASE_BOTON}>
              {cargando ? "Verificando…" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => setFase("email")}
              className="mt-3 w-full text-center text-xs text-bruma hover:text-tinta"
            >
              Usar otro correo
            </button>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rojo/30 bg-rojo-tenue p-2.5 text-[11px] text-rojo"
          >
            {error}
          </p>
        )}
      </m.div>
      <p className="mt-5 text-xs text-bruma-osc">
        ¿Sin cuenta?{" "}
        <Link href="/registro" className="font-semibold text-esmeralda hover:underline">
          Regístrate
        </Link>
      </p>
    </main>
  );
}
