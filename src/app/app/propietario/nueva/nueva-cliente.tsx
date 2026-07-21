"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Money } from "@/components/ui";
import { calcularNetoPropietario } from "@/lib/domain/split";

/**
 * Alta REAL de propiedad: nace con su tarifa neta y, si es la primera del
 * propietario, activa la suscripción del piloto. Publicada = visible para el
 * gremio (los externos solo ven propiedades publicadas y verificadas).
 */

const TIPOS = [
  { valor: "finca", label: "Finca" },
  { valor: "casa", label: "Casa" },
  { valor: "apartamento", label: "Apartamento" },
  { valor: "glamping", label: "Glamping" },
] as const;

function CampoTexto({
  etiqueta,
  valor,
  onCambio,
  placeholder,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">{etiqueta}</span>
      <input
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-sm text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50"
      />
    </label>
  );
}

function CampoNumero({
  etiqueta,
  valor,
  onCambio,
  min,
  max,
}: {
  etiqueta: string;
  valor: number;
  onCambio: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">{etiqueta}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onCambio(Number(e.target.value))}
        className="mt-1.5 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-sm text-tinta"
      />
    </label>
  );
}

export function NuevaPropiedadCliente() {
  const router = useRouter();
  const [f, setF] = useState({
    nombre: "",
    municipio: "",
    zona: "",
    tipo: "finca",
    capacidad: 8,
    habitaciones: 3,
    banos: 2,
    amenidades: "",
    reglas: "",
    tarifaNetaNochePesos: 800_000,
    publicada: true,
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const neto = calcularNetoPropietario(f.tarifaNetaNochePesos || 0);

  const crear = async () => {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch("/api/propiedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          amenidades: f.amenidades.split(",").map((s) => s.trim()).filter(Boolean),
          reglas: f.reglas.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo crear la propiedad");
      router.push("/app/propietario");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la propiedad");
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/app/propietario" className="text-xs font-semibold text-bruma transition hover:text-tinta">
          ← Volver al panel
        </Link>
        <h1 className="mt-2 font-display text-3xl text-tinta">Nueva propiedad</h1>
        <p className="mt-1 text-sm text-bruma">
          Nace con su tarifa neta. Al publicarla queda visible para el gremio;
          la verificación (certificado de tradición y libertad) la revisa la
          plataforma después.
        </p>
      </div>

      <Card className="space-y-5 p-6">
        <CampoTexto etiqueta="Nombre" valor={f.nombre} onCambio={(v) => setF({ ...f, nombre: v })} placeholder="Finca La Cascada" />
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoTexto etiqueta="Municipio" valor={f.municipio} onCambio={(v) => setF({ ...f, municipio: v })} placeholder="Guatapé" />
          <CampoTexto etiqueta="Zona" valor={f.zona} onCambio={(v) => setF({ ...f, zona: v })} placeholder="Oriente Antioqueño" />
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">Tipo</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                onClick={() => setF({ ...f, tipo: t.valor })}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  f.tipo === t.valor
                    ? "border-tiffany bg-tiffany-bruma text-tinta"
                    : "border-borde text-bruma hover:border-borde-claro"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <CampoNumero etiqueta="Capacidad" valor={f.capacidad} onCambio={(v) => setF({ ...f, capacidad: v })} min={1} max={50} />
          <CampoNumero etiqueta="Habitaciones" valor={f.habitaciones} onCambio={(v) => setF({ ...f, habitaciones: v })} min={1} max={30} />
          <CampoNumero etiqueta="Baños" valor={f.banos} onCambio={(v) => setF({ ...f, banos: v })} min={1} max={30} />
        </div>

        <CampoTexto
          etiqueta="Amenidades (separadas por coma)"
          valor={f.amenidades}
          onCambio={(v) => setF({ ...f, amenidades: v })}
          placeholder="Piscina, BBQ, WiFi, Jacuzzi"
        />
        <CampoTexto
          etiqueta="Reglas de la casa (separadas por coma)"
          valor={f.reglas}
          onCambio={(v) => setF({ ...f, reglas: v })}
          placeholder="No fiestas después de 11 pm, Check-in 3 pm"
        />
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
            Tarifa neta por noche (lo que TÚ recibes completo)
          </span>
          <input
            type="number"
            min={50_000}
            step={10_000}
            value={f.tarifaNetaNochePesos}
            onChange={(e) => setF({ ...f, tarifaNetaNochePesos: Number(e.target.value) })}
            className="mt-2 w-full rounded-xl border border-borde bg-panel px-4 py-3 text-lg font-bold text-tinta"
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-esmeralda/30 bg-esmeralda-tenue px-4 py-3 text-sm">
          <span className="font-semibold text-esmeralda">Recibes tras pasarela (~3%)</span>
          <Money valor={neto.recibe} className="text-lg font-bold text-esmeralda" />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-borde bg-panel p-4">
          <input
            type="checkbox"
            checked={f.publicada}
            onChange={(e) => setF({ ...f, publicada: e.target.checked })}
            className="mt-0.5 accent-tiffany"
          />
          <span className="text-xs leading-relaxed text-bruma">
            <span className="font-bold text-tinta">Publicar ya.</span> Visible para el
            gremio desde hoy. Recuerda: necesita entre 3 y 5 principales vinculados
            para operar con solicitudes.
          </span>
        </label>
      </Card>

      {error && (
        <p className="rounded-lg border border-rojo/30 bg-rojo-tenue p-3 text-[11px] text-rojo">{error}</p>
      )}
      <button
        onClick={crear}
        disabled={enviando}
        className="w-full rounded-full bg-tiffany py-3.5 text-sm font-bold text-tinta transition hover:bg-tiffany-claro disabled:opacity-60"
      >
        {enviando ? "Creando…" : "Crear propiedad →"}
      </button>
    </div>
  );
}
