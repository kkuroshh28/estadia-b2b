import Link from "next/link";
import { protegerAdmin } from "@/server/auth/guardia";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Métricas"],
  ["/admin/verificaciones", "Verificaciones"],
  ["/admin/antifuga", "Anti-fuga"],
  ["/admin/dinero", "Dinero"],
  ["/admin/configuracion", "Configuración"],
  ["/admin/dev", "Bandeja dev"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await protegerAdmin();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-borde bg-panel lg:flex">
        <Link href="/" className="border-b border-borde px-6 py-5">
          <p className="font-display text-xl text-tinta">
            THE CIRCLE<span className="text-rojo">.</span>
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-bruma-osc">
            Consola de operación
          </p>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3 py-6">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="block rounded-lg px-3 py-2 text-sm text-bruma transition hover:bg-tarjeta hover:text-tinta"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-borde p-4 text-[11px] text-bruma-osc">
          {admin ? (
            <>Sesión admin elevada (TOTP) · toda acción queda auditada</>
          ) : (
            <Badge tono="ambar">Modo demo — sin auth exigida</Badge>
          )}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
