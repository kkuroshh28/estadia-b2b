import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { obtenerDb } from "@/server/db";
import { authExigida, COOKIE_SESION, validarSesion } from "@/server/auth";
import { hayDb, usuarioDelPanel } from "@/server/datos/fuente";

// Paneles SIEMPRE dinámicos: jamás congelar datos en el build.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Vitrina sin DB: aliases de demostración en el shell.
  let alias: { principal: string | null; externo: string | null } = {
    principal: "CONDOR-472",
    externo: "GUACAMAYA-256",
  };
  let roles: string[] | null = null;
  if (hayDb()) {
    alias = { principal: null, externo: null };
    try {
      const db = obtenerDb();
      if (authExigida()) {
        const jar = await cookies();
        const sesion = await validarSesion(db, jar.get(COOKIE_SESION)?.value);
        roles = sesion?.roles ?? [];
        const propio = sesion ? await usuarioDelPanel(db, "principal", sesion) : null;
        alias = { principal: propio?.alias ?? null, externo: propio?.alias ?? null };
      } else {
        const [p, e] = await Promise.all([
          usuarioDelPanel(db, "principal", null),
          usuarioDelPanel(db, "externo", null),
        ]);
        alias = { principal: p?.alias ?? null, externo: e?.alias ?? null };
      }
    } catch {
      // sin datos aún: el shell no muestra alias
    }
  }
  return (
    <AppShell alias={alias} roles={roles} conDatos={hayDb()}>
      {children}
    </AppShell>
  );
}
