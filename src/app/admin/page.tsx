import { Card, Money, Stat } from "@/components/ui";
import { obtenerDb } from "@/server/db";
import { conciliar, metricas } from "@/server/servicios/admin";
import { SinDb, hayDb } from "./sin-db";

export const dynamic = "force-dynamic";

export default async function AdminMetricas() {
  if (!hayDb()) return <SinDb seccion="métricas" />;
  const db = obtenerDb();
  const { totales, porZona } = await metricas(db);
  const conc = await conciliar(db);
  const filasZona = porZona as unknown as { zona: string; reservas: number; comision_promedio: string }[];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="font-display text-3xl text-tinta">Métricas de la red</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat etiqueta="Reservas totales" valor={totales.reservas} />
        <Stat etiqueta="Con pago" valor={totales.pagadas} tono="esmeralda" />
        <Stat
          etiqueta="Comisión promedio"
          valor={<Money valor={Math.round(Number(totales.comisionPromedio) / 100)} />}
          detalle="El dato que decide cuándo activar el piso"
          tono="oro"
        />
        <Stat
          etiqueta="Volumen procesado"
          valor={<Money valor={Math.round(Number(totales.volumenCentavos) / 100)} />}
        />
      </div>

      <Card className={`p-5 ${conc.cuadra ? "border-esmeralda/30" : "border-rojo/50"}`}>
        <p className={`text-sm font-bold ${conc.cuadra ? "text-esmeralda" : "text-rojo"}`}>
          Conciliación: {conc.cuadra ? "CUADRA al centavo" : `⚠ ${conc.descuadres.length} descuadres`}
        </p>
        <p className="mt-1 text-xs text-bruma">
          {conc.transacciones} transacciones aprobadas verificadas (Σ splits = monto, por transacción).
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-borde px-6 py-4">
          <h2 className="font-display text-lg text-tinta">Comisión promedio por zona</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-borde">
            {filasZona.map((z) => (
              <tr key={z.zona} className="text-bruma">
                <td className="px-6 py-3 text-tinta">{z.zona}</td>
                <td className="cifra px-4 py-3">{z.reservas} reservas</td>
                <td className="cifra px-6 py-3 text-right text-oro">
                  <Money valor={Math.round(Number(z.comision_promedio) / 100)} />
                </td>
              </tr>
            ))}
            {filasZona.length === 0 && (
              <tr><td className="px-6 py-6 text-bruma-osc">Aún sin reservas con precio acordado.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
