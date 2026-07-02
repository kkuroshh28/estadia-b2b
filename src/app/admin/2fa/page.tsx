"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Segundo factor obligatorio para operar la consola admin. */
export default function Admin2FA() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const elevar = async () => {
    setError(null);
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    });
    if (res.ok) router.push("/admin");
    else setError((await res.json()).error ?? "Código inválido");
  };

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-3xl border border-borde bg-tarjeta p-8 text-center">
      <h1 className="font-display text-2xl text-tinta">Segundo factor</h1>
      <p className="mt-2 text-xs text-bruma">
        Ingresa el código de tu app de autenticación (TOTP). Obligatorio para toda
        acción administrativa.
      </p>
      <input
        inputMode="numeric"
        maxLength={6}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && elevar()}
        placeholder="000000"
        className="cifra mt-6 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-center text-2xl tracking-[0.4em] text-tinta"
      />
      <button
        onClick={elevar}
        disabled={codigo.length !== 6}
        className="mt-4 w-full rounded-full bg-tiffany py-3 text-sm font-bold text-tinta disabled:opacity-50"
      >
        Elevar sesión
      </button>
      {error && <p className="mt-3 text-xs text-rojo">{error}</p>}
    </div>
  );
}
