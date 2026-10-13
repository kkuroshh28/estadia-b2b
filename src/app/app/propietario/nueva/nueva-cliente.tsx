"use client";

import { useRef, useState } from "react";
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

const CLASE_ETIQUETA = "text-[11px] font-bold uppercase tracking-wider text-bruma-osc";
const CLASE_INPUT =
  "mt-1.5 w-full rounded-xl border bg-panel px-4 py-3 text-sm text-tinta placeholder:text-bruma-osc focus:border-esmeralda/50";

/** Estado del formulario: los numéricos son string para poder vaciarlos al editar. */
interface Formulario {
  nombre: string;
  municipio: string;
  zona: string;
  tipo: (typeof TIPOS)[number]["valor"];
  capacidad: string;
  habitaciones: string;
  banos: string;
  amenidades: string;
  reglas: string;
  tarifaNetaNochePesos: string;
  publicada: boolean;
  ownerDirect: boolean;
  margenMinimoPesos: string;
  huespedesIncluidos: string;
  tarifaAdicionalPesos: string;
  direccion: string;
  indicacionesLlegada: string;
}
type Campo = keyof Formulario;
type Errores = Partial<Record<Campo, string>>;

/** Valor de un input numérico: vacío → null; texto no numérico → NaN. */
const aNumero = (v: string): number | null => {
  const t = v.trim();
  return t === "" ? null : Number(t);
};
const lista = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

/**
 * Validación en cliente — espejo de las reglas zod de POST /api/propiedades
 * (el servidor sigue siendo la autoridad). Devuelve un mensaje por campo.
 */
function validar(f: Formulario): Errores {
  const e: Errores = {};
  const texto = (campo: Campo, valor: string, min: number, max: number, nombre: string) => {
    const t = valor.trim();
    if (t.length < min) e[campo] = `${nombre}: mínimo ${min} caracteres.`;
    else if (t.length > max) e[campo] = `${nombre}: máximo ${max} caracteres.`;
  };
  const entero = (campo: Campo, valor: string, min: number, max: number, nombre: string, opcional = false) => {
    const n = aNumero(valor);
    if (n === null) {
      if (!opcional) e[campo] = `${nombre}: requerido.`;
    } else if (!Number.isInteger(n)) {
      e[campo] = `${nombre}: debe ser un número entero.`;
    } else if (n < min || n > max) {
      e[campo] = `${nombre}: entre ${min.toLocaleString("es-CO")} y ${max.toLocaleString("es-CO")}.`;
    }
  };
  texto("nombre", f.nombre, 3, 80, "Nombre");
  texto("municipio", f.municipio, 2, 60, "Municipio");
  texto("zona", f.zona, 2, 60, "Zona");
  entero("capacidad", f.capacidad, 1, 50, "Capacidad");
  entero("habitaciones", f.habitaciones, 1, 30, "Habitaciones");
  entero("banos", f.banos, 1, 30, "Baños");
  const amen = lista(f.amenidades);
  if (amen.length > 12) e.amenidades = "Máximo 12 amenidades.";
  else if (amen.some((a) => a.length > 60)) e.amenidades = "Cada amenidad: máximo 60 caracteres.";
  const reg = lista(f.reglas);
  if (reg.length > 12) e.reglas = "Máximo 12 reglas.";
  else if (reg.some((r) => r.length > 80)) e.reglas = "Cada regla: máximo 80 caracteres.";
  const tarifa = aNumero(f.tarifaNetaNochePesos);
  if (tarifa === null) e.tarifaNetaNochePesos = "Define la tarifa neta por noche.";
  else if (!Number.isInteger(tarifa)) e.tarifaNetaNochePesos = "La tarifa debe ser un valor entero en pesos.";
  else if (tarifa < 50_000 || tarifa > 50_000_000)
    e.tarifaNetaNochePesos = `La tarifa neta va de ${pesos(50_000)} a ${pesos(50_000_000)}.`;
  entero("margenMinimoPesos", f.margenMinimoPesos, 0, 50_000_000, "Margen mínimo", true);
  const cap = aNumero(f.capacidad);
  const incl = aNumero(f.huespedesIncluidos);
  if (incl !== null && !Number.isInteger(incl)) {
    e.huespedesIncluidos = "Huéspedes incluidos: debe ser un número entero.";
  } else if (incl !== null && incl > 0) {
    if (incl > 50) e.huespedesIncluidos = "Huéspedes incluidos: máximo 50.";
    else if (cap !== null && incl > cap) e.huespedesIncluidos = "No puede superar la capacidad.";
  }
  entero("tarifaAdicionalPesos", f.tarifaAdicionalPesos, 0, 5_000_000, "Tarifa por adicional", true);
  if (f.direccion.trim().length > 200) e.direccion = "Dirección: máximo 200 caracteres.";
  if (f.indicacionesLlegada.trim().length > 400)
    e.indicacionesLlegada = "Indicaciones: máximo 400 caracteres.";
  return e;
}

/** Orden visual de los campos: al fallar el envío se enfoca el primero con error. */
const ORDEN_CAMPOS: Campo[] = [
  "nombre",
  "municipio",
  "zona",
  "capacidad",
  "habitaciones",
  "banos",
  "amenidades",
  "reglas",
  "direccion",
  "indicacionesLlegada",
  "tarifaNetaNochePesos",
  "margenMinimoPesos",
  "huespedesIncluidos",
  "tarifaAdicionalPesos",
];

const idCampo = (campo: Campo) => `nueva-${campo}`;

function ErrorCampo({ campo, error }: { campo: Campo; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${idCampo(campo)}-error`} role="alert" className="mt-1.5 text-[11px] text-rojo">
      {error}
    </p>
  );
}

/** Atributos de accesibilidad comunes de un campo (id, aria-invalid, aria-describedby). */
const aria = (campo: Campo, error?: string) => ({
  id: idCampo(campo),
  name: campo,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${idCampo(campo)}-error` : undefined,
});

function CampoTexto({
  campo,
  etiqueta,
  valor,
  onCambio,
  placeholder,
  error,
  requerido = false,
  minimo,
  maximo,
}: {
  campo: Campo;
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  placeholder?: string;
  error?: string;
  requerido?: boolean;
  minimo?: number;
  maximo?: number;
}) {
  return (
    <div>
      <label htmlFor={idCampo(campo)} className={`block ${CLASE_ETIQUETA}`}>
        {etiqueta}
      </label>
      <input
        {...aria(campo, error)}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        required={requerido}
        minLength={minimo}
        maxLength={maximo}
        className={`${CLASE_INPUT} ${error ? "border-rojo/60" : "border-borde"}`}
      />
      <ErrorCampo campo={campo} error={error} />
    </div>
  );
}

function CampoNumero({
  campo,
  etiqueta,
  valor,
  onCambio,
  min,
  max,
  step,
  error,
  requerido = false,
  className = "text-sm",
}: {
  campo: Campo;
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  min: number;
  max: number;
  step?: number;
  error?: string;
  requerido?: boolean;
  className?: string;
}) {
  return (
    <div>
      <label htmlFor={idCampo(campo)} className={`block ${CLASE_ETIQUETA}`}>
        {etiqueta}
      </label>
      <input
        {...aria(campo, error)}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        required={requerido}
        value={valor}
        // String: el campo se puede vaciar mientras se edita (se convierte al enviar).
        onChange={(e) => onCambio(e.target.value)}
        className={`${CLASE_INPUT} ${className} ${error ? "border-rojo/60" : "border-borde"}`}
      />
      <ErrorCampo campo={campo} error={error} />
    </div>
  );
}

export function NuevaPropiedadCliente() {
  const router = useRouter();
  const [f, setF] = useState<Formulario>({
    nombre: "",
    municipio: "",
    zona: "",
    tipo: "finca",
    capacidad: "8",
    habitaciones: "3",
    banos: "2",
    amenidades: "",
    reglas: "",
    tarifaNetaNochePesos: "800000",
    publicada: true,
    ownerDirect: false,
    margenMinimoPesos: "0",
    huespedesIncluidos: "0",
    tarifaAdicionalPesos: "0",
    direccion: "",
    indicacionesLlegada: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviandoRef = useRef(false);

  // Los errores por campo aparecen tras el primer intento de envío y se
  // recalculan en vivo mientras el usuario corrige.
  const errores = intentado ? validar(f) : {};
  const cambiar = <K extends Campo>(campo: K, valor: Formulario[K]) =>
    setF((prev) => ({ ...prev, [campo]: valor }));

  /** Número utilizable para cálculos en vivo (vacío/NaN → 0). */
  const n = (v: string) => {
    const x = aNumero(v);
    return x !== null && Number.isFinite(x) ? x : 0;
  };
  const tarifaN = n(f.tarifaNetaNochePesos);
  const margenN = n(f.margenMinimoPesos);
  const capacidadN = n(f.capacidad);
  const inclN = n(f.huespedesIncluidos);
  const adicionalN = n(f.tarifaAdicionalPesos);
  const neto = calcularNetoPropietario(tarifaN);

  const crear = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enviandoRef.current) return; // guard de doble envío (clic doble / Enter repetido)
    setIntentado(true);
    setError(null);
    const errs = validar(f);
    const primero = ORDEN_CAMPOS.find((c) => errs[c]);
    if (primero) {
      document.getElementById(idCampo(primero))?.focus();
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const r = await fetch("/api/propiedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: f.nombre.trim(),
          municipio: f.municipio.trim(),
          zona: f.zona.trim(),
          tipo: f.tipo,
          capacidad: capacidadN,
          habitaciones: n(f.habitaciones),
          banos: n(f.banos),
          amenidades: lista(f.amenidades),
          reglas: lista(f.reglas),
          tarifaNetaNochePesos: tarifaN,
          publicada: f.publicada,
          ownerDirect: f.ownerDirect,
          margenMinimoPesos: margenN,
          // 0 = sin adicionales: se omite para que toda la capacidad quede incluida.
          huespedesIncluidos: inclN > 0 ? inclN : undefined,
          tarifaAdicionalPesos: adicionalN,
          direccion: f.direccion.trim() || undefined,
          indicacionesLlegada: f.indicacionesLlegada.trim() || undefined,
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error ?? "No se pudo crear la propiedad");
      router.push("/app/propietario");
      router.refresh();
      // Se mantiene "enviando" hasta que la navegación desmonte el formulario.
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la propiedad");
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const hayErrores = Object.keys(errores).length > 0;

  return (
    <form onSubmit={crear} noValidate className="mx-auto max-w-3xl space-y-8">
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
        <CampoTexto campo="nombre" etiqueta="Nombre" valor={f.nombre} onCambio={(v) => cambiar("nombre", v)} placeholder="Finca La Cascada" error={errores.nombre} requerido minimo={3} maximo={80} />
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoTexto campo="municipio" etiqueta="Municipio" valor={f.municipio} onCambio={(v) => cambiar("municipio", v)} placeholder="Guatapé" error={errores.municipio} requerido minimo={2} maximo={60} />
          <CampoTexto campo="zona" etiqueta="Zona" valor={f.zona} onCambio={(v) => cambiar("zona", v)} placeholder="El Poblado" error={errores.zona} requerido minimo={2} maximo={60} />
        </div>

        <div role="group" aria-labelledby="nueva-tipo-etiqueta">
          <span id="nueva-tipo-etiqueta" className={CLASE_ETIQUETA}>Tipo</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                aria-pressed={f.tipo === t.valor}
                onClick={() => cambiar("tipo", t.valor)}
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
          <CampoNumero campo="capacidad" etiqueta="Capacidad" valor={f.capacidad} onCambio={(v) => cambiar("capacidad", v)} min={1} max={50} error={errores.capacidad} requerido />
          <CampoNumero campo="habitaciones" etiqueta="Habitaciones" valor={f.habitaciones} onCambio={(v) => cambiar("habitaciones", v)} min={1} max={30} error={errores.habitaciones} requerido />
          <CampoNumero campo="banos" etiqueta="Baños" valor={f.banos} onCambio={(v) => cambiar("banos", v)} min={1} max={30} error={errores.banos} requerido />
        </div>

        <CampoTexto
          campo="amenidades"
          etiqueta="Amenidades (separadas por coma)"
          valor={f.amenidades}
          onCambio={(v) => cambiar("amenidades", v)}
          error={errores.amenidades}
          placeholder="Piscina, BBQ, WiFi, Jacuzzi"
        />
        <CampoTexto
          campo="reglas"
          etiqueta="Reglas de la casa (separadas por coma)"
          valor={f.reglas}
          onCambio={(v) => cambiar("reglas", v)}
          error={errores.reglas}
          placeholder="No fiestas después de 11 pm, Check-in 3 pm"
        />
        <div className="rounded-xl border border-borde bg-panel p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
            Datos de llegada — identidad protegida
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-bruma">
            La dirección se guarda CIFRADA y solo se revela a las partes de una
            reserva con pago completo. Jamás aparece en la búsqueda ni en el chat.
          </p>
          <div className="mt-3 space-y-3">
            <CampoTexto
              campo="direccion"
              etiqueta="Dirección exacta"
              valor={f.direccion}
              onCambio={(v) => cambiar("direccion", v)}
              error={errores.direccion}
              maximo={200}
              placeholder="Km 4 vía Guatapé–El Peñol, portería Los Almendros"
            />
            <CampoTexto
              campo="indicacionesLlegada"
              etiqueta="Indicaciones de llegada"
              valor={f.indicacionesLlegada}
              onCambio={(v) => cambiar("indicacionesLlegada", v)}
              error={errores.indicacionesLlegada}
              maximo={400}
              placeholder="Entrada por la portería norte; el QR se muestra al vigilante"
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <CampoNumero
          campo="tarifaNetaNochePesos"
          etiqueta="Tarifa neta por noche (lo que TÚ recibes completo)"
          valor={f.tarifaNetaNochePesos}
          onCambio={(v) => cambiar("tarifaNetaNochePesos", v)}
          min={50_000}
          max={50_000_000}
          step={10_000}
          error={errores.tarifaNetaNochePesos}
          requerido
          className="text-lg font-bold"
        />
        <div className="flex items-center justify-between rounded-xl border border-esmeralda/30 bg-esmeralda-tenue px-4 py-3 text-sm">
          <span className="font-semibold text-esmeralda">Recibes tras pasarela (~3%)</span>
          <Money valor={neto.recibe} className="text-lg font-bold text-esmeralda" />
        </div>
        <div>
          <CampoNumero
            campo="margenMinimoPesos"
            etiqueta="Margen comercial mínimo (opcional)"
            valor={f.margenMinimoPesos}
            onCambio={(v) => cambiar("margenMinimoPesos", v)}
            min={0}
            max={50_000_000}
            step={50_000}
            error={errores.margenMinimoPesos}
            className="text-sm font-bold"
          />
          <p className="mt-1.5 text-[11px] text-bruma">
            Precio mínimo de venta:{" "}
            <Money
              valor={tarifaN + margenN}
              className="font-bold text-tinta"
            />{" "}
            por noche — ninguna oferta puede cerrar por debajo.
          </p>
        </div>

        <div className="rounded-xl border border-borde bg-panel p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-bruma-osc">
            Huéspedes adicionales (opcional)
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-bruma">
            Tu tarifa base cubre hasta cierto número de huéspedes; por cada
            persona extra se suma una tarifa por noche que es TUYA — entra
            directo a tu tarifa neta.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <CampoNumero
              campo="huespedesIncluidos"
              etiqueta="Huéspedes incluidos (0 = todos)"
              valor={f.huespedesIncluidos}
              onCambio={(v) => cambiar("huespedesIncluidos", v)}
              min={0}
              max={Math.min(50, capacidadN || 50)}
              error={errores.huespedesIncluidos}
            />
            <CampoNumero
              campo="tarifaAdicionalPesos"
              etiqueta="Tarifa por adicional / noche ($)"
              valor={f.tarifaAdicionalPesos}
              onCambio={(v) => cambiar("tarifaAdicionalPesos", v)}
              min={0}
              max={5_000_000}
              error={errores.tarifaAdicionalPesos}
            />
          </div>
          {inclN > 0 && adicionalN > 0 && (
            <p className="mt-2 text-[11px] text-bruma">
              Ejemplo: {capacidadN} huéspedes ={" "}
              <Money
                valor={tarifaN + Math.max(0, capacidadN - inclN) * adicionalN}
                className="font-bold text-esmeralda"
              />{" "}
              netos por noche para ti.
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-tiffany-claro bg-tiffany-bruma/30 p-4">
          <input
            type="checkbox"
            checked={f.ownerDirect}
            onChange={(e) => cambiar("ownerDirect", e.target.checked)}
            className="mt-0.5 accent-tiffany"
          />
          <span className="text-xs leading-relaxed text-bruma">
            <span className="font-bold text-tinta">Gestión directa (Owner Direct).</span>{" "}
            Tú mismo atiendes las solicitudes y negocias con los socios de ventas —
            sin socios comerciales — y recibes también la participación comercial
            del split, además de tu tarifa neta.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-borde bg-panel p-4">
          <input
            type="checkbox"
            checked={f.publicada}
            onChange={(e) => cambiar("publicada", e.target.checked)}
            className="mt-0.5 accent-tiffany"
          />
          <span className="text-xs leading-relaxed text-bruma">
            <span className="font-bold text-tinta">Publicar ya.</span> Visible para el
            gremio desde hoy. Recuerda: necesita entre 3 y 5 socios comerciales vinculados
            para operar con solicitudes.
          </span>
        </label>
      </Card>

      {hayErrores && (
        <p role="alert" className="rounded-lg border border-rojo/30 bg-rojo-tenue p-3 text-[11px] text-rojo">
          Revisa los campos marcados en rojo antes de crear la propiedad.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-rojo/30 bg-rojo-tenue p-3 text-[11px] text-rojo">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        aria-busy={enviando}
        className="w-full rounded-full bg-tiffany py-3.5 text-sm font-bold text-noche transition hover:bg-tiffany-claro disabled:opacity-60"
      >
        {enviando ? "Creando…" : "Crear propiedad →"}
      </button>
    </form>
  );
}
