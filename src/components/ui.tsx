import type { EstadoReserva } from "@/lib/domain/tipos";
import { ETIQUETA_ESTADO } from "@/lib/domain/reserva";
import { formatearCOP } from "@/lib/domain/split";

export function Money({ valor, className = "" }: { valor: number; className?: string }) {
  return <span className={`cifra ${className}`}>{formatearCOP(valor)}</span>;
}

type TonoBadge = "esmeralda" | "oro" | "rojo" | "ambar" | "azul" | "neutro";

const TONOS: Record<TonoBadge, string> = {
  esmeralda: "bg-esmeralda-tenue text-esmeralda border-esmeralda/25",
  oro: "bg-oro-tenue text-oro border-oro/25",
  rojo: "bg-rojo-tenue text-rojo border-rojo/25",
  ambar: "bg-ambar-tenue text-ambar border-ambar/25",
  azul: "bg-azul-tenue text-azul border-azul/25",
  neutro: "bg-tarjeta-alta text-bruma border-borde-claro/60",
};

export function Badge({
  tono = "neutro",
  children,
  vivo = false,
}: {
  tono?: TonoBadge;
  children: React.ReactNode;
  vivo?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${TONOS[tono]}`}
    >
      {vivo && <span className={`size-1.5 rounded-full bg-current pulso`} />}
      {children}
    </span>
  );
}

const TONO_ESTADO: Record<EstadoReserva, TonoBadge> = {
  SOLICITADA: "azul",
  ACEPTADA: "azul",
  NEGOCIACION: "ambar",
  PRECIO_ACORDADO: "ambar",
  LINK_1_ENVIADO: "ambar",
  ANTICIPO_PAGADO: "oro",
  SALDO_LINK_ENVIADO: "oro",
  PAGO_COMPLETO: "esmeralda",
  CHECK_IN: "esmeralda",
  COMPLETADA: "neutro",
  EXPIRADA: "neutro",
  INVALIDADA: "rojo",
  RECHAZADA: "rojo",
  CANCELADA: "rojo",
};

export function EstadoBadge({ estado, vivo = false }: { estado: EstadoReserva; vivo?: boolean }) {
  return (
    <Badge tono={TONO_ESTADO[estado]} vivo={vivo}>
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  );
}

export function Card({
  children,
  className = "",
  alta = false,
}: {
  children: React.ReactNode;
  className?: string;
  alta?: boolean;
}) {
  return (
    <div
      className={`elevada rounded-2xl border border-borde ${alta ? "bg-tarjeta-alta" : "bg-tarjeta"} ${className}`}
    >
      {children}
    </div>
  );
}

export function Stat({
  etiqueta,
  valor,
  detalle,
  tono = "tinta",
}: {
  etiqueta: string;
  valor: React.ReactNode;
  detalle?: string;
  tono?: "tinta" | "esmeralda" | "oro";
}) {
  const color =
    tono === "esmeralda" ? "text-esmeralda" : tono === "oro" ? "text-oro" : "text-tinta";
  return (
    <Card className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bruma">{etiqueta}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{valor}</p>
      {detalle && <p className="mt-1 text-xs text-bruma-osc">{detalle}</p>}
    </Card>
  );
}

/** Avatar genérico del alias — prohibidas las fotos reales (§3.2). */
export function AvatarAlias({ alias, size = 36 }: { alias: string; size?: number }) {
  const matiz = [...alias].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const iniciales = alias.split("-")[0].slice(0, 2);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${matiz} 45% 16%), hsl(${(matiz + 40) % 360} 40% 10%))`,
        borderColor: `hsl(${matiz} 40% 28%)`,
        color: `hsl(${matiz} 65% 68%)`,
      }}
    >
      {iniciales}
    </div>
  );
}

/** Carátula abstracta generada por propiedad — sin fotos externas en el demo. */
export function Cover({ matiz, className = "" }: { matiz: number; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `
          radial-gradient(ellipse 80% 70% at 25% 20%, hsl(${matiz} 42% 26% / 0.9), transparent 60%),
          radial-gradient(ellipse 70% 60% at 80% 75%, hsl(${(matiz + 45) % 360} 48% 20% / 0.85), transparent 65%),
          linear-gradient(160deg, hsl(${matiz} 30% 12%), hsl(${(matiz + 20) % 360} 25% 7%))`,
      }}
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `repeating-linear-gradient(115deg, transparent 0 22px, hsl(${matiz} 50% 45% / 0.16) 22px 23px)`,
        }}
      />
    </div>
  );
}

export function TituloSeccion({
  sobre,
  titulo,
  className = "",
}: {
  sobre?: string;
  titulo: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {sobre && (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-esmeralda">
          {sobre}
        </p>
      )}
      <h2 className="font-display text-3xl text-tinta sm:text-4xl">{titulo}</h2>
    </div>
  );
}
