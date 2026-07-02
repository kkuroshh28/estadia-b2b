import { desc } from "drizzle-orm";
import { Badge, Card } from "@/components/ui";
import { obtenerDb } from "@/server/db";
import { notificacionesDev } from "@/server/db/schema";
import { SinDb, hayDb } from "../sin-db";

export const dynamic = "force-dynamic";

/** Bandeja del driver de notificaciones "simulado" (emails/push que se habrían enviado). */
export default async function BandejaDev() {
  if (!hayDb()) return <SinDb seccion="bandeja dev" />;
  const filas = await obtenerDb()
    .select()
    .from(notificacionesDev)
    .orderBy(desc(notificacionesDev.enviadaEn))
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-tinta">Bandeja de notificaciones (driver simulado)</h1>
        <p className="mt-1 text-sm text-bruma">
          Todo lo que el driver real (Resend/FCM) habría enviado. Con
          EMAIL_DRIVER=resend esta bandeja deja de llenarse y se envía de verdad.
        </p>
      </div>
      <div className="space-y-3">
        {filas.map((n) => (
          <Card key={n.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tono={n.canal === "email" ? "azul" : "oro"}>{n.canal}</Badge>
                <span className="text-xs text-bruma">{n.destinatario}</span>
              </div>
              <span className="cifra text-[10px] text-bruma-osc">
                {n.enviadaEn.toISOString().slice(0, 16).replace("T", " ")}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-tinta">{n.asunto}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-bruma">{n.cuerpo}</p>
          </Card>
        ))}
        {filas.length === 0 && (
          <Card className="p-6 text-sm text-bruma-osc">Sin notificaciones aún.</Card>
        )}
      </div>
    </div>
  );
}
