import { Badge, Card } from "@/components/ui";
import { formatear } from "@/lib/dinero";
import { obtenerDb } from "@/server/db";
import { bandejaDinero, conciliar } from "@/server/servicios/admin";
import { accionReembolsar } from "../acciones";
import { SinDb, hayDb } from "../sin-db";

export const dynamic = "force-dynamic";

export default async function Dinero() {
  if (!hayDb()) return <SinDb seccion="dinero" />;
  const db = obtenerDb();
  const { trx, splits } = await bandejaDinero(db);
  const conc = await conciliar(db);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="font-display text-3xl text-tinta">Dinero</h1>

      <Card className={`p-5 ${conc.cuadra ? "border-esmeralda/30" : "border-rojo/60"}`}>
        <p className={`text-sm font-bold ${conc.cuadra ? "text-esmeralda" : "text-rojo"}`}>
          {conc.cuadra
            ? `Conciliación diaria: entradas = salidas, al centavo (${conc.transacciones} transacciones)`
            : `⚠ DESCUADRE en ${conc.descuadres.length} transacciones — detener dispersiones (runbook §6)`}
        </p>
        {!conc.cuadra &&
          conc.descuadres.map((d) => (
            <p key={d.transaccionId} className="cifra mt-1 text-xs text-rojo">
              {d.transaccionId}: monto {d.monto} ≠ Σ splits {d.sumaSplits}
            </p>
          ))}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-borde px-6 py-4">
          <h2 className="font-display text-lg text-tinta">Transacciones</h2>
          <p className="text-xs text-bruma">Reembolso = frase exacta + contra-splits + auditoría.</p>
        </div>
        <div className="divide-y divide-borde">
          {trx.slice(0, 25).map((t) => {
            const propios = splits.filter((s) => s.transaccionId === t.id);
            return (
              <div key={t.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="cifra text-xs text-bruma-osc">{t.pasarelaRef}</p>
                    <p className="cifra text-sm font-bold text-tinta">
                      {formatear(t.montoCentavos as never)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tono={t.estado === "aprobada" ? "esmeralda" : t.estado === "reversada" ? "rojo" : "neutro"}>
                      {t.estado}
                    </Badge>
                    {t.estado === "aprobada" && (
                      <form
                        action={async (fd: FormData) => {
                          "use server";
                          await accionReembolsar(t.id, String(fd.get("confirmacion") ?? ""));
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          name="confirmacion"
                          placeholder='"CONFIRMO REEMBOLSO"'
                          className="w-44 rounded-lg border border-rojo/40 bg-panel px-3 py-1.5 text-xs"
                        />
                        <button className="rounded-full border border-rojo/50 bg-rojo-tenue px-3 py-1.5 text-xs font-bold text-rojo">
                          Reembolsar
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-bruma">
                  {propios.map((s) => (
                    <span key={s.id} className="cifra">
                      {s.concepto}: {formatear(s.montoCentavos as never)}
                      {s.dispersado ? " ✓" : " · pendiente de dispersión"}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {trx.length === 0 && <p className="px-6 py-6 text-sm text-bruma-osc">Sin transacciones.</p>}
        </div>
      </Card>
    </div>
  );
}
