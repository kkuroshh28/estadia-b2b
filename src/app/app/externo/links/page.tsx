import Link from "next/link";
import { Badge, Card, Money, Stat } from "@/components/ui";
import { datosLinksExterno } from "@/server/datos/paneles";
import { SaldosPendientes } from "./saldo-boton";
import type { EstadoLink } from "@/lib/domain/tipos";

const TONO_LINK: Record<EstadoLink, { tono: "esmeralda" | "oro" | "rojo" | "neutro"; label: string }> = {
  activo: { tono: "oro", label: "Activo · esperando pago" },
  pagado: { tono: "esmeralda", label: "Pagado ✓" },
  expirado: { tono: "neutro", label: "Expirado" },
  invalidado: { tono: "rojo", label: "Invalidado — otro pagó primero" },
};

export default async function LinksDePago() {
  const datos = await datosLinksExterno();
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-tinta">Links de pago</h1>
        <p className="mt-1 text-sm text-bruma">
          Reenvía el link a TU cliente por WhatsApp o SMS — él no es usuario de la
          plataforma, así que ese canal sí está permitido. El estado se actualiza
          por webhook en tiempo real.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          etiqueta="Tasa de pago de tus links"
          valor={datos.tasaPago === null ? "—" : `${Math.round(datos.tasaPago * 100)}%`}
          detalle={`Parte de tu reputación como ${datos.aliasYo ?? "comisionista"}`}
          tono="esmeralda"
        />
        <Stat etiqueta="Comisiones · este mes" valor={<Money valor={datos.comisionesMes} />} detalle="40% de cada comisión acordada" tono="oro" />
        <Stat etiqueta="Links activos" valor={datos.links.filter((l) => l.estado === "activo").length} detalle="Con vigencia corriendo" />
      </div>

      <SaldosPendientes saldos={datos.saldosPendientes} />

      <div className="space-y-4">
        {datos.links.length === 0 && (
          <Card className="p-6 text-sm text-bruma">
            Aún no tienes links de pago. Cuando cierres una negociación, el link se
            genera solo — con el precio acordado, imposible de digitar distinto.
          </Card>
        )}
        {datos.links.map((l) => {
          const cfg = TONO_LINK[l.estado];
          return (
            <Card key={l.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[11px] text-bruma-osc">{l.codigoReserva}</p>
                    <Badge tono={cfg.tono} vivo={l.estado === "activo"}>
                      {cfg.label}
                    </Badge>
                    <Badge tono="neutro">Mitad {l.mitad} de 2</Badge>
                  </div>
                  <p className="mt-1.5 font-semibold text-tinta">{l.propiedadNombre}</p>
                  <p className="text-xs text-bruma">
                    {l.fechas.desde} → {l.fechas.hasta}
                    {l.estado === "activo" && ` · vence ${l.vence}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma-osc">
                      Monto de esta mitad
                    </p>
                    <Money valor={l.monto} className="text-lg font-bold text-tinta" />
                  </div>
                  {l.estado === "activo" ? (
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/pago/${l.id}`}
                        className="rounded-full bg-tiffany px-4 py-2 text-center text-[11px] font-bold text-tinta transition hover:bg-tiffany-claro"
                      >
                        Ver checkout
                      </Link>
                      <button className="rounded-full border border-oro/40 bg-oro-tenue px-4 py-2 text-[11px] font-bold text-oro">
                        Reenviar al cliente
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/pago/${l.id}`}
                      className="rounded-full border border-borde px-4 py-2 text-[11px] font-semibold text-bruma transition hover:text-tinta"
                    >
                      Ver estado
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="border-rojo/20 bg-rojo-tenue/30 p-5 text-[12px] leading-relaxed text-bruma">
        <span className="font-bold text-rojo">Regla crítica:</span> un link activo NO
        aparta fechas. Si otro externo logra que su cliente pague primero las mismas
        fechas, tu link se invalida en ese instante, muestra &ldquo;Fechas ya no
        disponibles&rdquo; y la tarjeta de tu cliente nunca se cobra.
      </Card>
    </div>
  );
}
