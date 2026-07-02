import { Badge, Card } from "@/components/ui";
import { obtenerDb } from "@/server/db";
import { bandejaAntifuga } from "@/server/servicios/admin";
import { accionRevertirBan } from "../acciones";
import { SinDb, hayDb } from "../sin-db";

export const dynamic = "force-dynamic";

export default async function Antifuga() {
  if (!hayDb()) return <SinDb seccion="anti-fuga" />;
  const { intentos, lista, porUsuario } = await bandejaAntifuga(obtenerDb());
  const usuarios = porUsuario as unknown as { id: string; email: string; estado: string; strikes: number }[];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="font-display text-3xl text-tinta">Anti-fuga</h1>

      <Card className="overflow-hidden">
        <div className="border-b border-borde px-6 py-4">
          <h2 className="font-display text-lg text-tinta">Strikes por usuario</h2>
        </div>
        <div className="divide-y divide-borde">
          {usuarios.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm text-tinta">{u.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tono={u.estado === "baneado" ? "rojo" : u.strikes >= 2 ? "ambar" : "neutro"}>
                    {u.strikes} strikes · {u.estado}
                  </Badge>
                </div>
              </div>
              {u.estado === "baneado" && (
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    await accionRevertirBan(
                      u.id,
                      String(fd.get("confirmacion") ?? ""),
                      String(fd.get("motivo") ?? ""),
                    );
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    name="motivo"
                    placeholder="Motivo documentado (error del sistema)"
                    className="w-56 rounded-lg border border-borde bg-panel px-3 py-2 text-xs"
                  />
                  <input
                    name="confirmacion"
                    placeholder='Escribe: "REVERTIR BAN DEFINITIVAMENTE"'
                    className="w-64 rounded-lg border border-rojo/40 bg-panel px-3 py-2 text-xs"
                  />
                  <button className="rounded-full border border-rojo/50 bg-rojo-tenue px-4 py-2 text-xs font-bold text-rojo">
                    Revertir (superadmin)
                  </button>
                </form>
              )}
            </div>
          ))}
          {usuarios.length === 0 && (
            <p className="px-6 py-6 text-sm text-bruma-osc">Sin intentos de fuga registrados.</p>
          )}
        </div>
        <p className="border-t border-borde px-6 py-3 text-[11px] text-bruma-osc">
          La política pública es ban perpetuo. La reversión existe para errores del
          SISTEMA, exige frase exacta + motivo y queda auditada. El alias retirado jamás vuelve.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-borde px-6 py-4">
            <h2 className="font-display text-lg text-tinta">Últimos intentos (evidencia)</h2>
          </div>
          <div className="max-h-80 divide-y divide-borde overflow-y-auto">
            {intentos.slice(0, 20).map((i) => (
              <div key={i.id} className="px-6 py-3">
                <Badge tono={i.accion === "ban_perpetuo" ? "rojo" : "ambar"}>{i.accion}</Badge>
                <p className="cifra mt-1 truncate text-[11px] text-bruma">
                  {JSON.stringify(i.evidencia)}
                </p>
              </div>
            ))}
            {intentos.length === 0 && <p className="px-6 py-6 text-sm text-bruma-osc">Vacío.</p>}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-borde px-6 py-4">
            <h2 className="font-display text-lg text-tinta">Lista negra de identidad</h2>
          </div>
          <div className="max-h-80 divide-y divide-borde overflow-y-auto">
            {lista.map((l) => (
              <div key={l.cedulaHash} className="px-6 py-3">
                <p className="cifra text-[11px] text-rojo">{l.cedulaHash.slice(0, 24)}…</p>
                <p className="text-xs text-bruma">{l.motivo}</p>
              </div>
            ))}
            {lista.length === 0 && <p className="px-6 py-6 text-sm text-bruma-osc">Vacía.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
