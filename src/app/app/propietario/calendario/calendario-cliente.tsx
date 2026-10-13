"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { m } from "motion/react";
import { Badge, Card } from "@/components/ui";
import { MoneyAnimado } from "@/components/motion";
import { calcularNetoPropietario } from "@/lib/domain/split";
import { mesVecino, type DatosCalendario } from "@/lib/domain/paneles";
import { SincronizacionIcal } from "./ical-cliente";
import type { EstadoDia } from "@/lib/domain/tipos";

/**
 * Calendario del propietario — una sola fuente de verdad de disponibilidad.
 * Solo el propietario tiene acceso de escritura. Bloqueo manual por clic o
 * arrastrando un rango. Los días reservados por la app son intocables: los
 * bloqueó el dinero. Con DB conectada, cada cambio persiste vía API (la regla
 * vive en el servidor); en demo pública el estado es local.
 */

const ESTILO_DIA: Record<EstadoDia, string> = {
  disponible:
    "border-borde bg-panel text-tinta hover:border-tiffany hover:bg-tiffany-bruma cursor-pointer",
  reservado_app: "border-tiffany bg-tiffany font-bold text-noche cursor-not-allowed",
  bloqueado_manual: "rayado border-borde-claro bg-panel text-bruma cursor-pointer",
  bloqueado_ical: "border-tiffany-claro bg-tiffany-claro/45 text-tinta cursor-not-allowed",
};

/** Texto del estado para lectores de pantalla. */
const TEXTO_ESTADO: Record<EstadoDia, string> = {
  disponible: "disponible",
  reservado_app: "reservado por la app",
  bloqueado_manual: "bloqueado por ti",
  bloqueado_ical: "bloqueado por Airbnb/Booking",
};

/** Mantener pulsado (táctil) este tiempo activa el arrastre; antes, el dedo hace scroll. */
const MS_PULSACION_LARGA = 350;
/** Movimiento (px) que, antes de activar el arrastre, se interpreta como scroll. */
const TOLERANCIA_PX = 8;

/** "Agosto 2026" + 15 → "15 de agosto de 2026". */
function fechaLegible(dia: number, titulo: string): string {
  const [mes, anio] = titulo.split(" ");
  return mes && anio ? `${dia} de ${mes.toLowerCase()} de ${anio}` : `${dia} ${titulo}`;
}

export function CalendarioCliente({
  datos,
  propiedadInicial,
}: {
  datos: DatosCalendario;
  propiedadInicial?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [propId, setPropId] = useState(
    datos.propiedades.find((p) => p.id === propiedadInicial)?.id ?? datos.propiedades[0]?.id ?? "",
  );
  // Al cambiar de mes se conserva la propiedad seleccionada.
  const irAlMes = (delta: 1 | -1) => {
    const qs = new URLSearchParams({ mes: mesVecino(datos.mes.iso, delta) });
    if (propId) qs.set("propiedad", propId);
    router.push(`${pathname}?${qs.toString()}`);
  };
  // Overlay local sobre los estados del servidor (optimista).
  const [cambios, setCambios] = useState<Record<string, Partial<Record<number, "bloqueado_manual" | "disponible">>>>({});
  const [recientes, setRecientes] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const arrastre = useRef<{ inicio: number; hasta: number } | null>(null);
  const [rangoVivo, setRangoVivo] = useState<[number, number] | null>(null);
  /** true SOLO mientras hay un arrastre activo: ahí (y solo ahí) se bloquea el scroll táctil. */
  const [arrastrando, setArrastrando] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  /** Pulsación táctil en espera de convertirse en arrastre (pulsación larga). */
  const pendiente = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);
  /** Evita que el click que sigue a un arrastre vuelva a alternar el día. */
  const suprimirClick = useRef(false);

  const prop = datos.propiedades.find((p) => p.id === propId);
  const [tarifa, setTarifa] = useState(prop?.tarifaNetaNoche ?? 0);
  const neto = useMemo(() => calcularNetoPropietario(tarifa), [tarifa]);
  const [guardandoTarifa, setGuardandoTarifa] = useState(false);
  const [tarifaGuardada, setTarifaGuardada] = useState(false);

  const guardarTarifa = async () => {
    setGuardandoTarifa(true);
    setError(null);
    try {
      const r = await fetch("/api/propiedades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedadId: propId, tarifaNetaNochePesos: tarifa }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo guardar la tarifa");
      setTarifaGuardada(true);
      setTimeout(() => setTarifaGuardada(false), 2500);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la tarifa");
    } finally {
      setGuardandoTarifa(false);
    }
  };

  const estadoDe = (dia: number): EstadoDia => {
    const local = cambios[propId]?.[dia];
    if (local) return local;
    return datos.estados[propId]?.[dia] ?? "disponible";
  };

  const editable = (dia: number) => {
    const e = estadoDe(dia);
    return e === "disponible" || e === "bloqueado_manual";
  };

  const persistir = async (dias: number[], accion: "bloquear" | "liberar") => {
    if (datos.esDemo) return; // demo pública: solo estado local
    const fechas = dias.map((d) => `${datos.mes.iso}-${String(d).padStart(2, "0")}`);
    try {
      const r = await fetch("/api/calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedadId: propId, fechas, accion }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error al guardar");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cambio");
      // Revertir el overlay local de esos días.
      setCambios((prev) => {
        const propCambios = { ...(prev[propId] ?? {}) };
        for (const d of dias) delete propCambios[d];
        return { ...prev, [propId]: propCambios };
      });
    }
  };

  /** Bloquea/libera un solo día (clic, toque o teclado Enter/Espacio). */
  const alternarDia = (dia: number) => {
    if (!editable(dia)) return;
    if (estadoDe(dia) === "bloqueado_manual") {
      setCambios((prev) => ({
        ...prev,
        [propId]: { ...(prev[propId] ?? {}), [dia]: "disponible" },
      }));
      void persistir([dia], "liberar");
      return;
    }
    setRecientes([dia]);
    setCambios((prev) => ({
      ...prev,
      [propId]: { ...(prev[propId] ?? {}), [dia]: "bloqueado_manual" },
    }));
    void persistir([dia], "bloquear");
  };

  /** Bloquea los días disponibles del rango [a, b] (arrastre). */
  const bloquearRango = (a: number, b: number) => {
    const nuevos = Array.from({ length: b - a + 1 }, (_, i) => a + i).filter(
      (d) => estadoDe(d) === "disponible",
    );
    if (nuevos.length === 0) return;
    setRecientes(nuevos);
    setCambios((prev) => {
      const propCambios = { ...(prev[propId] ?? {}) };
      for (const d of nuevos) propCambios[d] = "bloqueado_manual";
      return { ...prev, [propId]: propCambios };
    });
    void persistir(nuevos, "bloquear");
  };

  const empezarArrastre = (dia: number) => {
    if (!editable(dia)) return;
    arrastre.current = { inicio: dia, hasta: dia };
    setRangoVivo([dia, dia]);
    setArrastrando(true);
  };

  /** Día bajo el puntero (funciona en táctil: el toque no dispara pointerenter en otros días). */
  const diaEnPunto = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-dia]");
    if (!el || !gridRef.current?.contains(el)) return null;
    const dia = Number(el.dataset.dia);
    return Number.isFinite(dia) ? dia : null;
  };

  const extenderArrastre = (dia: number) => {
    if (!arrastre.current || arrastre.current.hasta === dia) return;
    arrastre.current.hasta = dia;
    setRangoVivo([
      Math.min(arrastre.current.inicio, dia),
      Math.max(arrastre.current.inicio, dia),
    ]);
  };

  const cancelarPendiente = () => {
    if (pendiente.current) window.clearTimeout(pendiente.current.timer);
    pendiente.current = null;
  };

  const alPresionar = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = (e.target as Element).closest<HTMLElement>("[data-dia]");
    if (!el) return;
    const dia = Number(el.dataset.dia);
    if (!editable(dia)) return;
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      e.preventDefault(); // sin selección de texto ni foco "arrastrado"
      el.focus();
      empezarArrastre(dia);
      return;
    }
    // Táctil/lápiz: el navegador captura implícitamente el puntero en el
    // elemento tocado; se libera para que el arrastre recorra otros días.
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    cancelarPendiente();
    const id = e.pointerId;
    pendiente.current = {
      id,
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        if (pendiente.current?.id !== id) return;
        pendiente.current = null;
        empezarArrastre(dia);
      }, MS_PULSACION_LARGA),
    };
  };

  const alMoverAntesDeArrastre = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pendiente.current;
    if (!p || p.id !== e.pointerId) return;
    // El dedo se movió antes de la pulsación larga → es scroll, no arrastre.
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TOLERANCIA_PX) cancelarPendiente();
  };

  const terminarArrastre = useEffectEvent((cancelado: boolean) => {
    const drag = arrastre.current;
    arrastre.current = null;
    setRangoVivo(null);
    setArrastrando(false);
    if (!drag || cancelado) return;
    const [a, b] = [Math.min(drag.inicio, drag.hasta), Math.max(drag.inicio, drag.hasta)];
    if (a === b) alternarDia(a);
    else bloquearRango(a, b);
    // El click que el navegador dispara tras soltar no debe re-alternar el día.
    suprimirClick.current = true;
    window.setTimeout(() => {
      suprimirClick.current = false;
    }, 0);
  });

  const moverArrastre = useEffectEvent((x: number, y: number) => {
    const dia = diaEnPunto(x, y);
    if (dia !== null) extenderArrastre(dia);
  });

  // Listeners globales SOLO durante el arrastre: seguir el puntero fuera de la
  // celda inicial y frenar el scroll táctil (touchmove no pasivo).
  useEffect(() => {
    if (!arrastrando) return;
    const mover = (e: PointerEvent) => moverArrastre(e.clientX, e.clientY);
    const soltar = () => terminarArrastre(false);
    const cancelar = () => terminarArrastre(true);
    const sinScroll = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener("pointermove", mover);
    document.addEventListener("pointerup", soltar);
    document.addEventListener("pointercancel", cancelar);
    document.addEventListener("touchmove", sinScroll, { passive: false });
    return () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerup", soltar);
      document.removeEventListener("pointercancel", cancelar);
      document.removeEventListener("touchmove", sinScroll);
    };
  }, [arrastrando]);

  // Limpia una pulsación larga pendiente al desmontar.
  useEffect(() => () => cancelarPendiente(), []);

  // Sin propiedades: los hooks de arriba ya se llamaron (orden estable).
  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-3xl text-tinta">Calendario y tarifa neta</h1>
        <Card className="p-8 text-sm text-bruma">
          Aún no tienes propiedades registradas. Al publicar la primera, su
          calendario vive aquí — y solo tú puedes escribirlo.
        </Card>
      </div>
    );
  }

  const enRangoVivo = (dia: number) =>
    rangoVivo !== null && dia >= rangoVivo[0] && dia <= rangoVivo[1] && editable(dia);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-tinta">Calendario y tarifa neta</h1>
        <p className="mt-1 text-sm text-bruma">
          Eres el único con acceso de escritura. Haz clic (o Enter) en un día para
          bloquearlo o liberarlo, o arrastra para bloquear un rango completo — en el
          celular, mantén pulsado un día y desliza.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {datos.propiedades.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPropId(p.id);
              setTarifa(p.tarifaNetaNoche ?? 0);
            }}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              p.id === propId
                ? "border-tiffany bg-tiffany-bruma text-tinta"
                : "border-borde text-bruma hover:border-borde-claro hover:text-tinta"
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* CALENDARIO */}
        <Card className="p-6 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => irAlMes(-1)}
                aria-label="Mes anterior"
                className="flex size-8 items-center justify-center rounded-full border border-borde text-bruma transition hover:border-tiffany hover:text-tinta"
              >
                ‹
              </button>
              <h2 className="min-w-40 text-center font-display text-xl text-tinta">{datos.mes.titulo}</h2>
              <button
                onClick={() => irAlMes(1)}
                aria-label="Mes siguiente"
                className="flex size-8 items-center justify-center rounded-full border border-borde text-bruma transition hover:border-tiffany hover:text-tinta"
              >
                ›
              </button>
            </div>
            {(datos.ical[propId]?.imports.length ?? 0) > 0 && (
              <Badge tono="esmeralda">iCal sincronizado</Badge>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-rojo/30 bg-rojo-tenue p-2 text-[11px] text-rojo">
              {error}
            </p>
          )}
          <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-bruma-osc">
            {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div
            ref={gridRef}
            role="group"
            aria-label={`Días de ${datos.mes.titulo}`}
            className="mt-2 grid select-none grid-cols-7 gap-1.5"
            // touch-action:none SOLO durante un arrastre activo: el resto del
            // tiempo el dedo hace scroll normal sobre el calendario.
            style={{ touchAction: arrastrando ? "none" : "manipulation", WebkitTouchCallout: "none" }}
            onPointerDown={alPresionar}
            onPointerMove={alMoverAntesDeArrastre}
            onPointerUp={cancelarPendiente}
            onPointerCancel={cancelarPendiente}
            onContextMenu={(e) => {
              if (pendiente.current || arrastrando) e.preventDefault();
            }}
          >
            {Array.from({ length: datos.mes.offsetLunes }).map((_, i) => (
              <div key={`v-${i}`} />
            ))}
            {Array.from({ length: datos.mes.dias }, (_, i) => i + 1).map((dia) => {
              const estado = estadoDe(dia);
              const seleccionando = enRangoVivo(dia);
              const recien = recientes.includes(dia) && estado === "bloqueado_manual";
              const puedeEditar = editable(dia);
              return (
                <button
                  key={dia}
                  type="button"
                  data-dia={dia}
                  onClick={() => {
                    if (suprimirClick.current || !puedeEditar) return;
                    alternarDia(dia); // también Enter/Espacio (botón nativo)
                  }}
                  aria-pressed={estado === "bloqueado_manual"}
                  aria-disabled={!puedeEditar || undefined}
                  aria-label={`${fechaLegible(dia, datos.mes.titulo)}: ${TEXTO_ESTADO[estado]}${
                    puedeEditar
                      ? estado === "bloqueado_manual"
                        ? ". Pulsa para liberar"
                        : ". Pulsa para bloquear"
                      : ""
                  }`}
                  className={`cifra relative aspect-square rounded-lg border text-sm transition ${
                    seleccionando
                      ? "border-oro bg-oro-tenue text-oro"
                      : ESTILO_DIA[estado]
                  }`}
                  title={TEXTO_ESTADO[estado]}
                >
                  {dia}
                  {recien && (
                    <m.span
                      initial={{ scale: 0, rotate: -35, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-tiffany text-[9px] text-noche"
                    >
                      🔒
                    </m.span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-4 border-t border-borde pt-4 text-[11px] text-bruma">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded border border-borde bg-panel" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-tiffany" /> Reservado por la app (pago confirmado)</span>
            <span className="flex items-center gap-1.5"><span className="rayado size-2.5 rounded border border-borde-claro" /> Bloqueo manual tuyo</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-tiffany-claro" /> Sincronizado Airbnb/Booking</span>
          </div>
          <p className="mt-4 rounded-xl border border-esmeralda/20 bg-esmeralda-tenue/40 p-3 text-[11px] leading-relaxed text-bruma">
            <span className="font-bold text-esmeralda">Sin holds:</span> una negociación
            o un link activo NO bloquean fechas. Solo el webhook del Pago 1 lo hace —
            por eso este calendario nunca miente.
          </p>
        </Card>

        {/* CALCULADORA DE NETO */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-xl text-tinta">Calculadora de neto</h2>
          <p className="mt-1 text-xs text-bruma">
            Fija tu tarifa sabiendo exactamente qué recibes. El ~3% de pasarela es tu
            único costo — la comisión de los socios va por encima.
          </p>
          <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
            Tarifa neta por noche · {prop.nombre}
          </label>
          {prop.tarifaNetaNoche === 0 && (
            <p className="mt-2 rounded-lg border border-oro/30 bg-oro-tenue/40 px-3 py-2 text-[11px] text-oro">
              Sin tarifa definida: la propiedad no se puede publicar hasta que la guardes.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-borde bg-panel px-4 py-2.5 focus-within:border-tiffany">
            <span className="text-sm text-bruma">$</span>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Tarifa neta por noche en pesos"
              placeholder="Escribe la tarifa neta por noche"
              value={tarifa > 0 ? tarifa.toLocaleString("es-CO") : ""}
              onChange={(e) => setTarifa(Number(e.target.value.replace(/\D/g, "").slice(0, 9)) || 0)}
              className="cifra w-full bg-transparent text-lg font-bold text-tinta outline-none placeholder:text-sm placeholder:font-normal placeholder:text-bruma-osc"
            />
            <span className="text-xs text-bruma-osc">COP</span>
          </div>
          <input
            type="range"
            min={50_000}
            max={Math.max(20_000_000, tarifa)}
            step={50_000}
            value={Math.max(tarifa, 50_000)}
            onChange={(e) => setTarifa(Number(e.target.value))}
            aria-label="Ajustar tarifa"
            className="mt-3 w-full accent-tiffany"
          />
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-borde bg-panel px-4 py-3">
              <span className="text-sm text-bruma">Tarifa neta</span>
              <MoneyAnimado valor={neto.tarifaNeta} className="text-lg font-bold text-tinta" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-borde bg-panel px-4 py-3">
              <span className="text-sm text-bruma">Pasarela (~3%)</span>
              <MoneyAnimado valor={-neto.costoPasarelaEstimado} className="text-sm font-semibold text-rojo" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-esmeralda/30 bg-esmeralda-tenue px-4 py-3">
              <span className="text-sm font-semibold text-esmeralda">Tú recibes</span>
              <MoneyAnimado valor={neto.recibe} className="text-lg font-bold text-esmeralda" />
            </div>
          </div>
          {!datos.esDemo && (
            <button
              onClick={guardarTarifa}
              disabled={guardandoTarifa || tarifa < 50_000 || tarifa === prop.tarifaNetaNoche}
              className="mt-4 w-full rounded-full bg-tiffany py-3 text-xs font-bold text-noche transition hover:bg-tiffany-claro disabled:opacity-50"
            >
              {tarifaGuardada
                ? "Tarifa guardada ✓"
                : guardandoTarifa
                  ? "Guardando…"
                  : `Guardar tarifa (desde hoy)`}
            </button>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-bruma-osc">
            Si el cliente paga más (comisión negociada por encima), la pasarela cobra
            sobre el total procesado; tu neto puede variar unos pesos. Siempre lo ves
            antes de confirmar. Cambiarla abre una nueva temporada desde hoy — las
            reservas ya negociadas conservan la suya.
          </p>
        </Card>
      </div>

      {!datos.esDemo && datos.ical[propId] && (
        <SincronizacionIcal propiedadId={propId} ical={datos.ical[propId]} />
      )}
    </div>
  );
}
