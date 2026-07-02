import { Card } from "@/components/ui";
import { obtenerDb } from "@/server/db";
import { configuracionPlataforma } from "@/server/db/schema";
import { accionEditarConfig } from "../acciones";
import { SinDb, hayDb } from "../sin-db";

export const dynamic = "force-dynamic";

const EDITABLES = ["piso_comision", "vigencias", "pasarela"];

export default async function Configuracion() {
  if (!hayDb()) return <SinDb seccion="configuración" />;
  const filas = await obtenerDb().select().from(configuracionPlataforma);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-tinta">Configuración de plataforma</h1>
        <p className="mt-1 text-sm text-bruma">
          Cada cambio queda auditado con tu identidad y el valor anterior. El split
          50/40/10 es regla de negocio: no es editable.
        </p>
      </div>

      {filas
        .filter((f) => EDITABLES.includes(f.clave))
        .map((f) => (
          <Card key={f.clave} className="p-6">
            <h2 className="font-display text-lg text-tinta">{f.clave}</h2>
            {f.clave === "piso_comision" && (
              <p className="mt-1 text-xs text-bruma">
                Programado desde el MVP, apagado al lanzamiento. Encenderlo hace que
                la negociación rechace ofertas bajo neta + pct (probado por test).
              </p>
            )}
            <form
              action={async (fd: FormData) => {
                "use server";
                await accionEditarConfig(f.clave, String(fd.get("valor") ?? "{}"));
              }}
              className="mt-4 flex flex-wrap items-start gap-3"
            >
              <textarea
                name="valor"
                defaultValue={JSON.stringify(f.valor, null, 2)}
                rows={4}
                className="cifra min-w-72 flex-1 rounded-xl border border-borde bg-panel p-3 text-xs text-tinta"
              />
              <button className="rounded-full bg-tiffany px-5 py-2.5 text-xs font-bold text-tinta hover:bg-tiffany-claro">
                Guardar (auditado)
              </button>
            </form>
          </Card>
        ))}
    </div>
  );
}
