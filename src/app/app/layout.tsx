import { AppShell } from "@/components/app-shell";
import { obtenerDb } from "@/server/db";
import { hayDb, usuarioDelPanel } from "@/server/datos/fuente";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let alias: { principal: string | null; externo: string | null } = { principal: null, externo: null };
  if (hayDb()) {
    try {
      const db = obtenerDb();
      const [p, e] = await Promise.all([
        usuarioDelPanel(db, "principal", null),
        usuarioDelPanel(db, "externo", null),
      ]);
      alias = { principal: p?.alias ?? "—", externo: e?.alias ?? "—" };
    } catch {
      // sin datos aún: el shell no muestra alias
    }
  }
  return <AppShell alias={alias}>{children}</AppShell>;
}
