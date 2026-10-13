"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AvatarAlias, Badge } from "./ui";
import { Campanita } from "./campanita";
import { LogoCircle } from "./logo";

interface AliasShell {
  principal: string | null;
  externo: string | null;
}

type RolPanel = "propietario" | "principal" | "externo";

const ROL_DE_SECCION: Record<string, RolPanel | null> = {
  Propietario: "propietario",
  "Socio Comercial": "principal",
  "Socio de Ventas": "externo",
  "Común": null, // visible para todos
};

const SECCIONES = (alias: AliasShell) => [
  {
    rol: "Propietario",
    alias: null as string | null,
    items: [
      { href: "/app/propietario", label: "Panel y reservas" },
      { href: "/app/propietario/calendario", label: "Calendario y tarifa" },
      { href: "/app/propietario/principales", label: "Mis socios" },
    ],
  },
  {
    rol: "Socio Comercial",
    alias: alias.principal,
    items: [
      { href: "/app/principal", label: "Solicitudes entrantes" },
      { href: "/app/negociacion", label: "Módulo de negociación" },
      { href: "/app/principal/comisiones", label: "Mis comisiones" },
    ],
  },
  {
    rol: "Socio de Ventas",
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

type Seccion = ReturnType<typeof SECCIONES>[number];

/** Etiqueta corta + icono de cada destino en la barra inferior móvil. */
const CORTO_MOVIL: Record<string, { label: string; icono: string }> = {
  "/app/propietario": { label: "Panel", icono: "▦" },
  "/app/propietario/calendario": { label: "Calendario", icono: "▤" },
  "/app/propietario/principales": { label: "Socios", icono: "◎" },
  "/app/principal": { label: "Solicitudes", icono: "◉" },
  "/app/negociacion": { label: "Negociar", icono: "⇄" },
  "/app/principal/comisiones": { label: "Comisiones", icono: "$" },
  "/app/externo": { label: "Buscar", icono: "⌕" },
  "/app/externo/links": { label: "Links", icono: "⛓" },
  "/app/externo/comisiones": { label: "Comisiones", icono: "$" },
  "/app/chat": { label: "Chat", icono: "✉" },
};
const MAX_NAV_MOVIL = 5;

/**
 * Barra inferior generada desde las secciones VISIBLES (ya filtradas por rol):
 * un solo rol → sus ítems en orden; varios → reparto equitativo (primer ítem
 * de cada rol, luego el segundo…). El chat común siempre cierra la barra.
 */
function navMovil(secciones: Seccion[]) {
  const deRol = secciones.filter((s) => s.rol !== "Común");
  const comunes = secciones.filter((s) => s.rol === "Común").flatMap((s) => s.items);
  const cupo = Math.max(0, MAX_NAV_MOVIL - comunes.length);
  const elegidos: { href: string; label: string }[] = [];
  const maxItems = Math.max(0, ...deRol.map((s) => s.items.length));
  for (let i = 0; i < maxItems && elegidos.length < cupo; i++) {
    for (const s of deRol) {
      if (s.items[i] && elegidos.length < cupo) elegidos.push(s.items[i]);
    }
  }
  const ordenados = deRol.length === 1 ? deRol[0].items.slice(0, cupo) : elegidos;
  return [...ordenados, ...comunes].slice(0, MAX_NAV_MOVIL).map((i) => ({
    href: i.href,
    label: CORTO_MOVIL[i.href]?.label ?? i.label,
    icono: CORTO_MOVIL[i.href]?.icono ?? "•",
  }));
}

/** Ruta activa = el href MÁS LARGO que coincide (exacto o como prefijo de segmento). */
function hrefActivo(pathname: string, hrefs: string[]): string | null {
  let mejor: string | null = null;
  for (const h of hrefs) {
    const coincide = pathname === h || pathname.startsWith(`${h}/`);
    if (coincide && (!mejor || h.length > mejor.length)) mejor = h;
  }
  return mejor;
}

export function AppShell({
  children,
  alias = { principal: null, externo: null },
  roles = null,
  conDatos = false,
}: {
  children: React.ReactNode;
  alias?: AliasShell;
  /** Con sesión real: solo se muestran las secciones de estos roles. */
  roles?: string[] | null;
  /** true cuando hay base de datos: enciende la campanita. */
  conDatos?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const salir = async () => {
    await fetch("/api/auth/sesion", { method: "DELETE" }).catch(() => null);
    router.push("/login");
    router.refresh();
  };
  /** Modo piloto sin auth: se navegan los tres roles con textos de demostración. */
  const sinAuth = roles === null;
  const secciones = SECCIONES(alias).filter((s) => {
    if (!roles) return true; // piloto sin auth: se navegan los tres
    const rol = ROL_DE_SECCION[s.rol];
    return rol === null || roles.includes(rol);
  });
  const activo = hrefActivo(
    pathname,
    secciones.flatMap((s) => s.items.map((i) => i.href)),
  );
  const seccionActiva = secciones.find((s) => s.items.some((i) => i.href === activo));
  const nav = navMovil(secciones);
  const activoMovil = hrefActivo(
    pathname,
    nav.map((i) => i.href),
  );
  const rolCampanita: RolPanel =
    ROL_DE_SECCION[seccionActiva?.rol ?? ""] ??
    (roles?.find((r): r is RolPanel => r === "propietario" || r === "principal" || r === "externo") ??
      "propietario");

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-borde bg-panel lg:flex">
        <Link href="/" className="border-b border-borde px-6 py-5">
          <p className="font-display text-xl text-tinta">
            <LogoCircle tam={26} />
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-bruma-osc">
            Red B2B · Colombia
          </p>
        </Link>
        <nav aria-label="Secciones" className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
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
                  const esActivo = i.href === activo;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      aria-current={esActivo ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm transition ${
                        esActivo
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
        </nav>
        {sinAuth && (
          <div className="border-t border-borde p-4">
            <div className="rounded-xl border border-oro/20 bg-oro-tenue/50 p-3 text-[11px] leading-relaxed text-bruma">
              <span className="font-bold text-oro">Piloto.</span> Un usuario real solo
              ve el rol que le corresponde; aquí navegas los tres para operar la
              plataforma completa.
            </div>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-borde bg-fondo/85 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-display text-lg text-tinta lg:hidden">
              <LogoCircle tam={26} />
            </Link>
            <span className="hidden text-sm text-bruma lg:inline">
              {seccionActiva ? `Vista de ${seccionActiva.rol}` : "Selecciona un rol"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {conDatos && <Campanita rol={rolCampanita} />}
            <Badge tono="esmeralda" vivo>Piloto</Badge>
            {!sinAuth && (
              <button
                onClick={salir}
                className="rounded-full border border-borde px-3 py-1.5 text-[11px] font-semibold text-bruma transition hover:border-rojo/40 hover:text-rojo"
              >
                Salir
              </button>
            )}
            {seccionActiva?.alias ? (
              <div className="flex items-center gap-2">
                <AvatarAlias alias={seccionActiva.alias} size={32} />
                <span className="hidden font-mono text-xs text-bruma sm:inline">
                  {seccionActiva.alias}
                </span>
              </div>
            ) : sinAuth ? (
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full border border-esmeralda/30 bg-esmeralda-tenue text-xs font-bold text-esmeralda">
                  P
                </div>
                <span className="hidden text-xs text-bruma sm:inline">Propietario verificado</span>
              </div>
            ) : seccionActiva && seccionActiva.rol !== "Común" ? (
              // Con sesión real: solo el rol que de verdad se está viendo, sin sellos inventados.
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full border border-esmeralda/30 bg-esmeralda-tenue text-xs font-bold text-esmeralda">
                  {seccionActiva.rol.charAt(0)}
                </div>
                <span className="hidden text-xs text-bruma sm:inline">{seccionActiva.rol}</span>
              </div>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-5 pb-24 pt-8 sm:px-8 lg:pb-8">{children}</main>

        {/* NAV INFERIOR (móvil): generada desde los roles visibles */}
        {nav.length > 0 && (
          <nav
            aria-label="Navegación principal"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-panel/95 backdrop-blur lg:hidden"
          >
            <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
              {nav.map((i) => {
                const esActivo = i.href === activoMovil;
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    aria-current={esActivo ? "page" : undefined}
                    className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition ${
                      esActivo ? "font-bold text-tinta" : "text-bruma-osc hover:text-bruma"
                    }`}
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      {i.icono}
                    </span>
                    {i.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
