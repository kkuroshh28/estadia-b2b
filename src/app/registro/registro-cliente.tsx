"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AvatarAlias } from "@/components/ui";
import { generarAlias } from "@/lib/domain/alias";

/**
 * Onboarding (§8.1): rol → datos → cédula/biometría → cuenta bancaria →
 * (comisionistas) REVELACIÓN DEL ALIAS → aceptación de la regla anti-fuga.
 * Con DB (staging/dev): el registro es REAL — /api/registro crea el usuario
 * (cédula cifrada, alias único de la DB) y el KYC simulado lo aprueba por el
 * MISMO callback firmado del proveedor. Sin DB: demo visual.
 */

type Rol = "Propietario" | "Comisionista Principal" | "Comisionista Externo";

const PASOS = ["Rol", "Datos", "Identidad", "Banco", "Alias", "Reglas"];

function Progreso({ paso }: { paso: number }) {
  return (
    <div className="flex items-center gap-2">
      {PASOS.map((p, i) => (
        <div key={p} className="flex flex-1 flex-col gap-1.5">
          <motion.div
            className={`h-1 rounded-full ${i <= paso ? "bg-esmeralda" : "bg-borde"}`}
            initial={false}
            animate={{ opacity: i <= paso ? 1 : 0.5 }}
          />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${i <= paso ? "text-esmeralda" : "text-bruma-osc"}`}>
            {p}
          </span>
        </div>
      ))}
    </div>
  );
}

function Campo({
  etiqueta,
  placeholder,
  tipo = "text",
  valor,
  onCambio,
}: {
  etiqueta: string;
  placeholder: string;
  tipo?: string;
  valor?: string;
  onCambio?: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">{etiqueta}</span>
      <input
        type={tipo}
        placeholder={placeholder}
        value={valor}
        onChange={onCambio ? (e) => onCambio(e.target.value) : undefined}
        className="mt-1.5 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-sm text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50"
      />
    </label>
  );
}

function BotonSiguiente({ onClick, children = "Continuar →" }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-6 w-full rounded-full bg-tiffany py-3.5 text-sm font-bold text-tinta transition hover:bg-tiffany-claro"
    >
      {children}
    </button>
  );
}

const ROL_API: Record<Rol, "propietario" | "principal" | "externo"> = {
  Propietario: "propietario",
  "Comisionista Principal": "principal",
  "Comisionista Externo": "externo",
};

function Registro({ real }: { real: boolean }) {
  const params = useSearchParams();
  const rolParam = params.get("rol") as Rol | null;
  const [paso, setPaso] = useState(rolParam ? 1 : 0);
  const [rol, setRol] = useState<Rol | null>(rolParam);
  const [biometriaLista, setBiometriaLista] = useState(false);
  const [aceptaBan, setAceptaBan] = useState(false);
  const [aceptaInterno, setAceptaInterno] = useState(false);
  const [datos, setDatos] = useState({ nombre: "", cedula: "", celular: "", correo: "" });
  const [enviando, setEnviando] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);
  const [aliasReal, setAliasReal] = useState<string | null>(null);
  const aliasDemo = useMemo(() => generarAlias(), []);
  const alias = aliasReal ?? aliasDemo;
  const esComisionista = rol !== "Propietario";

  // Biometría simulada: 2.4 s de "escaneo" y confirma.
  useEffect(() => {
    if (paso === 2 && !biometriaLista) {
      const t = setTimeout(() => setBiometriaLista(true), 2400);
      return () => clearTimeout(t);
    }
  }, [paso, biometriaLista]);

  const avanzarDesdeBanco = async () => {
    if (!real) {
      setErrorRegistro(
        "La plataforma está en preparación: el registro se habilita cuando se conecte la base de datos del piloto.",
      );
      return;
    }
    // Registro REAL: usuario en DB (pendiente_kyc) + alias único + KYC simulado
    // aprobado por el callback firmado — el mismo camino del proveedor real.
    setEnviando(true);
    setErrorRegistro(null);
    try {
      const r = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreReal: datos.nombre,
          cedula: datos.cedula,
          telefono: datos.celular,
          email: datos.correo,
          rol: ROL_API[rol ?? "Comisionista Externo"],
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo crear la cuenta");
      if (json.alias) setAliasReal(json.alias);
      await fetch("/api/kyc/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId: json.kycCheckId }),
      }).catch(() => null);
      setPaso(esComisionista ? 4 : 5);
    } catch (e) {
      setErrorRegistro(e instanceof Error ? e.message : "No se pudo crear la cuenta");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="atmosfera flex min-h-screen flex-col items-center px-6 py-10">
      <Link href="/" className="font-display text-2xl text-tinta">
        THE CIRCLE<span className="text-tiffany">.</span>
      </Link>

      <div className="mt-8 w-full max-w-lg">
        <Progreso paso={paso} />

        <div className="mt-8 rounded-3xl border border-borde bg-tarjeta p-8">
          <AnimatePresence mode="wait">
            {/* PASO 0 · ROL */}
            {paso === 0 && (
              <motion.div key="rol" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
                <h1 className="font-display text-2xl text-tinta">¿Cuál es tu rol en el gremio?</h1>
                <div className="mt-6 space-y-3">
                  {(["Propietario", "Comisionista Principal", "Comisionista Externo"] as Rol[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => { setRol(r); setPaso(1); }}
                      className="w-full rounded-2xl border border-borde bg-panel p-5 text-left transition hover:border-tiffany hover:bg-tarjeta-alta"
                    >
                      <p className="font-semibold text-tinta">{r}</p>
                      <p className="mt-1 text-xs text-bruma">
                        {r === "Propietario"
                          ? "Publicas propiedades, fijas tu tarifa neta y controlas tu calendario."
                          : r === "Comisionista Principal"
                            ? "Gestionas solicitudes de propiedades vinculadas. Ganas 50% de la comisión."
                            : "Traes tus clientes y vendes con inventario real. Ganas 40% de la comisión."}
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* PASO 1 · DATOS */}
            {paso === 1 && (
              <motion.div key="datos" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
                <h1 className="font-display text-2xl text-tinta">Tus datos reales</h1>
                <p className="mt-1 text-xs text-bruma">
                  Solo para verificación, pagos y contratos. {esComisionista && "Otros usuarios jamás los verán: operarás con un alias."}
                </p>
                <div className="mt-6 space-y-4">
                  <Campo etiqueta="Nombre completo" placeholder="Como aparece en tu cédula" valor={datos.nombre} onCambio={(v) => setDatos((d) => ({ ...d, nombre: v }))} />
                  <Campo etiqueta="Cédula" placeholder="1.234.567.890" valor={datos.cedula} onCambio={(v) => setDatos((d) => ({ ...d, cedula: v }))} />
                  <Campo etiqueta="Celular" placeholder="300 000 0000" tipo="tel" valor={datos.celular} onCambio={(v) => setDatos((d) => ({ ...d, celular: v }))} />
                  <Campo etiqueta="Correo" placeholder="tu@correo.com" tipo="email" valor={datos.correo} onCambio={(v) => setDatos((d) => ({ ...d, correo: v }))} />
                </div>
                <BotonSiguiente onClick={() => setPaso(2)} />
              </motion.div>
            )}

            {/* PASO 2 · BIOMETRÍA */}
            {paso === 2 && (
              <motion.div key="bio" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="text-center">
                <h1 className="font-display text-2xl text-tinta">Verificación de identidad</h1>
                <p className="mt-1 text-xs text-bruma">Cédula + rostro. Con esto tu identidad queda blindada — y el ban, si lo hubiera, también.</p>
                <div className="relative mx-auto mt-8 flex size-36 items-center justify-center rounded-full border border-borde bg-panel">
                  {!biometriaLista ? (
                    <>
                      <motion.div
                        className="absolute inset-x-6 h-0.5 rounded bg-tiffany"
                        animate={{ top: ["18%", "80%", "18%"] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <span className="text-4xl opacity-60">🪪</span>
                    </>
                  ) : (
                    <motion.div
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 16 }}
                      className="flex size-20 items-center justify-center rounded-full bg-esmeralda-tenue text-3xl text-esmeralda"
                    >
                      ✓
                    </motion.div>
                  )}
                </div>
                <p className="mt-4 cifra text-xs text-bruma">
                  {biometriaLista ? "Identidad verificada" : "Escaneando documento…"}
                </p>
                {biometriaLista && <BotonSiguiente onClick={() => setPaso(3)} />}
              </motion.div>
            )}

            {/* PASO 3 · BANCO */}
            {paso === 3 && (
              <motion.div key="banco" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
                <h1 className="font-display text-2xl text-tinta">Cuenta bancaria certificada</h1>
                <p className="mt-1 text-xs text-bruma">
                  Aquí llegan tus dispersiones automáticas. La certificación evita fraudes de suplantación.
                </p>
                <div className="mt-6 space-y-4">
                  <Campo etiqueta="Banco" placeholder="Bancolombia" />
                  <Campo etiqueta="Número de cuenta" placeholder="000-000000-00" />
                  <div className="rounded-xl border border-dashed border-borde-claro bg-panel p-4 text-center text-xs text-bruma">
                    Arrastra aquí tu certificación bancaria (PDF)
                  </div>
                </div>
                {errorRegistro && (
                  <p className="mt-4 rounded-lg border border-rojo/30 bg-rojo-tenue p-3 text-[11px] text-rojo">
                    {errorRegistro}
                  </p>
                )}
                <BotonSiguiente onClick={avanzarDesdeBanco}>
                  {enviando ? "Creando tu cuenta…" : "Continuar →"}
                </BotonSiguiente>
              </motion.div>
            )}

            {/* PASO 4 · REVELACIÓN DEL ALIAS */}
            {paso === 4 && (
              <motion.div key="alias" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -24 }} className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-bruma-osc">
                  Desde hoy, en The Circle nadie sabrá quién eres
                </p>
                <h1 className="mt-3 font-display text-2xl text-tinta">Tu identidad en el gremio es</h1>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0, filter: "blur(8px)" }}
                  animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 180, damping: 16 }}
                  className="mx-auto mt-6 inline-flex flex-col items-center gap-3 rounded-3xl border border-tiffany-claro bg-tiffany-bruma px-10 py-8"
                  style={{ boxShadow: "0 0 60px rgba(10,186,181,0.22)" }}
                >
                  <AvatarAlias alias={alias} size={56} />
                  <p className="cifra text-3xl font-bold tracking-wide text-tinta">{alias}</p>
                </motion.div>
                <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-bruma">
                  Aleatorio, único e irrepetible. No se puede cambiar ni transferir. Tu
                  reputación, tu ranking y tu historial viven en este alias: cuídalo
                  como a tu marca.
                </p>
                <BotonSiguiente onClick={() => setPaso(5)}>Entendido, es mío →</BotonSiguiente>
              </motion.div>
            )}

            {/* PASO 5 · REGLAS */}
            {paso === 5 && (
              <motion.div key="reglas" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <h1 className="font-display text-2xl text-tinta">Las reglas que no se negocian</h1>
                <div className="mt-5 space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-borde bg-panel p-4">
                    <input type="checkbox" checked={aceptaInterno} onChange={(e) => setAceptaInterno(e.target.checked)} className="mt-0.5 accent-tiffany" />
                    <span className="text-xs leading-relaxed text-bruma">
                      Toda comunicación y negociación ocurre <span className="font-bold text-tinta">dentro de la app</span>. WhatsApp o cualquier canal externo entre usuarios está prohibido.
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rojo/25 bg-rojo-tenue/40 p-4">
                    <input type="checkbox" checked={aceptaBan} onChange={(e) => setAceptaBan(e.target.checked)} className="mt-0.5 accent-tiffany" />
                    <span className="text-xs leading-relaxed text-bruma">
                      Entiendo que intercambiar datos de contacto significa{" "}
                      <span className="font-bold text-rojo">ban perpetuo e inmediato, sin apelación</span>, aplicado a mi cédula y biometría — no solo a mi cuenta.
                    </span>
                  </label>
                </div>
                {aceptaBan && aceptaInterno ? (
                  <Link
                    href="/app"
                    className="mt-6 block w-full rounded-full bg-tiffany py-3.5 text-center text-sm font-bold text-tinta transition hover:bg-tiffany-claro"
                  >
                    Crear mi cuenta y entrar →
                  </Link>
                ) : (
                  <p className="mt-6 text-center text-[11px] text-bruma-osc">
                    Acepta ambas reglas para continuar. Sin excepciones — para nadie.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-4 text-center text-[10px] text-bruma-osc">
          {real
            ? "Tu cuenta se crea de verdad: cédula cifrada en reposo, alias único asignado por la plataforma y verificación KYC."
            : "La plataforma está en preparación — el registro se habilita al conectar la base de datos del piloto."}
        </p>
      </div>
    </main>
  );
}

export function RegistroCliente({ real }: { real: boolean }) {
  return (
    <Suspense>
      <Registro real={real} />
    </Suspense>
  );
}
