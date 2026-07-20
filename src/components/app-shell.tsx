"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AvatarAlias, Badge } from "./ui";

interface AliasShell {
  principal: string | null;
  externo: string | null;
}

const SECCIONES = (alias: AliasShell) => [
  {
    rol: "Propietario",
    alias: null as string | null,
    items: [
      { href: "/app/propietario", label: "Panel y reservas" },
      { href: "/app/propietario/calendario", label: "Calendario y tarifa" },
      { href: "/app/propietario/principales", label: "Mis principales" },
    ],
  },
  {
    rol: "C. Principal",
    alias: alias.principal,
    items: [
      { href: "/app/principal", label: "Solicitudes entrantes" },
      { href: "/app/negociacion", label: "Módulo de negociación" },
      { href: "/app/principal/comisiones", label: "Mis comisiones" },
    ],
  },
  {
    rol: "C. Externo",
    alias: alias.externo,
    items: [
      { href: "/app/externo", label: "Buscar disponibilidad" },
      { href: "/app/externo/links", label: "Links de pago" },
      { href: "/app/externo/comisiones", label: "Mis comisiones" },
    ],
  },
  {
    rol: "Común",
    alias: null,
    items: [{ href: "/app/chat", label: "Chat interno" }],
  },
];

const NAV_MOVIL = [
  { href: "/app/propietario", label: "Panel", icono: "▦" },
  { href: "/app/principal", label: "Solicitudes", icono: "◉" },
  { href: "/app/externo", label: "Buscar", icono: "⌕" },
  { href: "/app/chat", label: "Chat", icono: "✉" },
  { href: "/app/externo/links", label: "Links", icono: "⛓" },
];

export function AppShell({
  children,
  alias = { principal: "CONDOR-472", externo: "GUACAMAYA-256" },
}: {
  children: React.ReactNode;
  alias?: AliasShell;
}) {
  const pathname = usePathname();
  const secciones = SECCIONES(alias);
  const seccionActiva = secciones.find((s) =>
    s.items.some((i) => pathname.startsWith(i.href)),
  );

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-borde bg-panel lg:flex">
        <Link href="/" className="border-b border-borde px-6 py-5">
          <p className="font-display text-xl text-tinta">
            ESTADÍA<span className="text-tiffany">.</span>
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-bruma-osc">
            Red B2B · Antioquia
          </p>
        </Link>
        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
          {secciones.map((s) => (
            <div key={s.rol}>
              <div className="flex items-center gap-2 px-3 pb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bruma-osc">
                  {s.rol}
                </p>
                {s.alias && (
                  <span className="font-mono text-[10px] text-bruma">{s.alias}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {s.items.map((i) => {
                  const activo = pathname === i.href;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={`block rounded-lg px-3 py-2 text-sm transition ${
                        activo
                          ? "bg-tiffany-bruma font-semibold text-tinta"
                          : "text-bruma hover:bg-tarjeta hover:text-tinta"
                      }`}
                    >
                      {i.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-borde p-4">
          <div className="rounded-xl border border-oro/20 bg-oro-tenue/50 p-3 text-[11px] leading-relaxed text-bruma">
            <span className="font-bold text-oro">Entorno demo.</span> Un usuario real
            solo ve el rol que le corresponde. Aquí navegas los tres para evaluar el
            producto.
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-borde bg-fondo/85 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-display text-lg text-tinta lg:hidden">
              ESTADÍA<span className="text-tiffany">.</span>
            </Link>
            <span className="hidden text-sm text-bruma lg:inline">
              {seccionActiva ? `Vista de ${seccionActiva.rol}` : "Selecciona un rol"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge tono="esmeralda" vivo>Demo en vivo</Badge>
            {seccionActiva?.alias ? (
              <div className="flex items-center gap-2">
                <AvatarAlias alias={seccionActiva.alias} size={32} />
                <span className="hidden font-mono text-xs text-bruma sm:inline">
                  {seccionActiva.alias}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full border border-esmeralda/30 bg-esmeralda-tenue text-xs font-bold text-esmeralda">
                  P
                </div>
                <span className="hidden text-xs text-bruma sm:inline">Propietario verificado</span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-5 pb-24 pt-8 sm:px-8 lg:pb-8">{children}</main>

        {/* NAV INFERIOR (móvil) */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-panel/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
            {NAV_MOVIL.map((i) => {
              const activo = pathname.startsWith(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition ${
                    activo ? "font-bold text-tinta" : "text-bruma-osc hover:text-bruma"
                  }`}
                >
                  <span className="text-base leading-none">{i.icono}</span>
                  {i.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
