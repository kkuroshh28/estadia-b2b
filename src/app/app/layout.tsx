import { AppShell } from "@/components/app-shell";
import { obtenerDb } from "@/server/db";
import { hayDb, usuarioDelPanel } from "@/server/datos/fuente";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let alias = { principal: "CONDOR-472", externo: "GUACAMAYA-256" };
  if (hayDb()) {
    try {
      const db = obtenerDb();
      const [p, e] = await Promise.all([
        usuarioDelPanel(db, "principal", null),
        usuarioDelPanel(db, "externo", null),
      ]);
      alias = { principal: p?.alias ?? "—", externo: e?.alias ?? "—" };
    } catch {
      // demo pública: alias de demostración
    }
  }
  return <AppShell alias={alias}>{children}</AppShell>;
}
