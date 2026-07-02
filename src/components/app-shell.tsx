"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AvatarAlias, Badge } from "./ui";

const SECCIONES = [
  {
    rol: "Propietario",
    alias: null,
    items: [
      { href: "/app/propietario", label: "Panel y reservas" },
      { href: "/app/propietario/calendario", label: "Calendario y tarifa" },
    ],
  },
  {
    rol: "C. Principal",
    alias: "CONDOR-472",
    items: [
      { href: "/app/principal", label: "Solicitudes entrantes" },
      { href: "/app/negociacion", label: "Módulo de negociación" },
    ],
  },
  {
    rol: "C. Externo",
    alias: "GUACAMAYA-256",
    items: [
      { href: "/app/externo", label: "Buscar disponibilidad" },
      { href: "/app/externo/links", label: "Links de pago" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const seccionActiva = SECCIONES.find((s) =>
    s.items.some((i) => pathname.startsWith(i.href)),
  );

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-borde bg-panel lg:flex">
        <Link href="/" className="border-b border-borde px-6 py-5">
          <p className="font-display text-xl text-tinta">
            ESTADÍA<span className="text-esmeralda">.</span>
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-bruma-osc">
            Red B2B · Antioquia
          </p>
        </Link>
        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
          {SECCIONES.map((s) => (
            <div key={s.rol}>
              <div className="flex items-center gap-2 px-3 pb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bruma-osc">
                  {s.rol}
                </p>
                {s.alias && (
                  <span className="font-mono text-[10px] text-oro/80">{s.alias}</span>
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
                          ? "bg-esmeralda-tenue font-semibold text-esmeralda"
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
              ESTADÍA<span className="text-esmeralda">.</span>
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

        {/* Nav móvil */}
        <div className="flex gap-2 overflow-x-auto border-b border-borde bg-panel px-4 py-2 lg:hidden">
          {SECCIONES.flatMap((s) => s.items).map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${
                pathname === i.href
                  ? "border-esmeralda/40 bg-esmeralda-tenue text-esmeralda"
                  : "border-borde text-bruma"
              }`}
            >
              {i.label}
            </Link>
          ))}
        </div>

        <main className="flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
