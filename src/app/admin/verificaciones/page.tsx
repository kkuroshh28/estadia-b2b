import { Badge, Card } from "@/components/ui";
import { obtenerDb } from "@/server/db";
import { bandejaVerificaciones } from "@/server/servicios/admin";
import { accionAprobarPropiedad, accionResolverKyc } from "../acciones";
import { SinDb, hayDb } from "../sin-db";

export const dynamic = "force-dynamic";

export default async function Verificaciones() {
  if (!hayDb()) return <SinDb seccion="verificaciones" />;
  const { props, kycs } = await bandejaVerificaciones(obtenerDb());

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="font-display text-3xl text-tinta">Verificaciones</h1>

      <Card className="overflow-hidden">
        <div className="border-b border-borde px-6 py-4">
          <h2 className="font-display text-lg text-tinta">Propiedades pendientes de sello</h2>
          <p className="text-xs text-bruma">Revisar certificado de tradición y libertad antes de aprobar.</p>
        </div>
        <div className="divide-y divide-borde">
          {props.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="font-semibold text-tinta">{p.nombre}</p>
                <p className="text-xs text-bruma">
                  {p.municipio} · {p.zona} ·{" "}
                  {p.certTradicionLibertadUrl ? (
                    <a href={p.certTradicionLibertadUrl} className="text-esmeralda hover:underline">
                      ver certificado
                    </a>
                  ) : (
                    <span className="text-ambar">sin certificado adjunto</span>
                  )}
                </p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await accionAprobarPropiedad(p.id);
                }}
              >
                <button className="rounded-full bg-tiffany px-5 py-2 text-xs font-bold text-tinta hover:bg-tiffany-claro">
                  Otorgar sello Verificada
                </button>
              </form>
            </div>
          ))}
          {props.length === 0 && (
            <p className="px-6 py-6 text-sm text-bruma-osc">Sin propiedades pendientes.</p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-borde px-6 py-4">
          <h2 className="font-display text-lg text-tinta">KYC en revisión manual</h2>
          <p className="text-xs text-bruma">
            Resolver pasa por el MISMO núcleo del adaptador: la lista negra aplica igual.
          </p>
        </div>
        <div className="divide-y divide-borde">
          {kycs.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm text-tinta">{k.email}</p>
                <p className="cifra text-[11px] text-bruma-osc">{k.kycProveedorId}</p>
              </div>
              <div className="flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    if (k.kycProveedorId) await accionResolverKyc(k.kycProveedorId, true);
                  }}
                >
                  <button className="rounded-full border border-esmeralda/40 bg-esmeralda-tenue px-4 py-2 text-xs font-bold text-esmeralda">
                    Aprobar
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    if (k.kycProveedorId) await accionResolverKyc(k.kycProveedorId, false);
                  }}
                >
                  <button className="rounded-full border border-rojo/40 bg-rojo-tenue px-4 py-2 text-xs font-bold text-rojo">
                    Rechazar
                  </button>
                </form>
              </div>
            </div>
          ))}
          {kycs.length === 0 && <p className="px-6 py-6 text-sm text-bruma-osc">Sin KYCs pendientes.</p>}
        </div>
      </Card>
      <Badge tono="neutro">Toda decisión queda en auditoria_admin con tu identidad</Badge>
    </div>
  );
}
