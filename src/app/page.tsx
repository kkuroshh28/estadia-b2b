import Link from "next/link";
import { Badge, Money } from "@/components/ui";
import { calcularSplit } from "@/lib/domain/split";

const EJEMPLO = calcularSplit(1_200_000, 1_000_000);

const PRINCIPIOS = [
  {
    t: "100% B2B",
    d: "Solo tres roles usan la app: Propietario, Comisionista Principal y Comisionista Externo. El cliente final nunca entra; solo recibe un link de pago.",
  },
  {
    t: "El primero que paga, gana",
    d: "Sin holds ni reservas tentativas. El calendario solo se bloquea cuando entra el Pago 1, confirmado por webhook en tiempo real.",
  },
  {
    t: "Tarifa neta intocable",
    d: "El propietario fija su tarifa y siempre la recibe completa. La comisión se negocia por encima, jamás se descuenta de ella.",
  },
  {
    t: "Identidad verificada, operación anónima",
    d: "KYC con cédula y biometría para entrar; adentro, cada comisionista opera con un alias autogenerado, único e irrepetible.",
  },
  {
    t: "Todo pasa dentro de la app",
    d: "Chat, negociación y coordinación son internos. Intercambiar datos de contacto = ban perpetuo a la identidad, no a la cuenta.",
  },
  {
    t: "Pago 50/50, siempre tarjeta",
    d: "50% para reservar, 50% el día de ingreso. Cada mitad se reparte automáticamente al entrar, sin retenciones. Efectivo prohibido.",
  },
];

const FLUJO = [
  "Solicitada",
  "Aceptada",
  "Negociación",
  "Precio acordado",
  "Link 1 enviado",
  "Anticipo pagado",
  "Link saldo",
  "Pago completo ✓",
  "Check-in",
  "Completada",
];

export default function Landing() {
  return (
    <main className="grano atmosfera min-h-screen">
      {/* NAV */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-display text-2xl tracking-wide text-tinta">
          ESTADÍA<span className="text-esmeralda">.</span>
        </p>
        <div className="hidden items-center gap-8 text-sm text-bruma sm:flex">
          <a href="#modelo" className="transition hover:text-tinta">Modelo</a>
          <a href="#principios" className="transition hover:text-tinta">Principios</a>
          <a href="#flujo" className="transition hover:text-tinta">Flujo</a>
        </div>
        <Link
          href="/app"
          className="rounded-full border border-esmeralda/40 bg-esmeralda-tenue px-5 py-2 text-sm font-bold text-esmeralda transition hover:bg-esmeralda hover:text-fondo"
        >
          Entrar a la demo
        </Link>
      </nav>

      {/* HERO */}
      <header className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
        <div className="revelar revelar-1 flex flex-wrap items-center gap-2">
          <Badge tono="esmeralda" vivo>Piloto · Oriente Antioqueño</Badge>
          <Badge tono="oro">B2B · el huésped nunca usa la app</Badge>
        </div>
        <h1 className="revelar revelar-2 mt-6 max-w-4xl font-display text-5xl leading-[1.04] text-tinta sm:text-7xl">
          El calendario solo se bloquea{" "}
          <em className="text-esmeralda">con dinero</em>, nunca con promesas.
        </h1>
        <p className="revelar revelar-3 mt-6 max-w-2xl text-lg leading-relaxed text-bruma">
          La red B2B que conecta propietarios de rentas cortas en Antioquia con su
          red de comisionistas. Negociación formal con las cartas sobre la mesa,
          split automático 50/40/10 y pago garantizado por link. El primero que
          paga, gana las fechas.
        </p>
        <div className="revelar revelar-4 mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/app"
            className="rounded-full bg-esmeralda px-7 py-3.5 text-sm font-bold text-fondo transition hover:brightness-110"
          >
            Explorar la plataforma →
          </Link>
          <a
            href="#modelo"
            className="rounded-full border border-borde-claro px-7 py-3.5 text-sm font-semibold text-bruma transition hover:border-oro/50 hover:text-oro"
          >
            Ver el modelo de dinero
          </a>
        </div>

        <div className="revelar revelar-5 mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-borde bg-borde sm:grid-cols-4">
          {[
            ["50 / 40 / 10", "split de la comisión"],
            ["~3%", "único costo del propietario"],
            ["1 noche – 3 meses", "rentas cortas únicamente"],
            ["0 holds", "sin reservas tentativas"],
          ].map(([v, k]) => (
            <div key={k} className="bg-panel px-6 py-5">
              <p className="cifra text-xl font-bold text-oro">{v}</p>
              <p className="mt-1 text-xs text-bruma">{k}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="linea-oro mx-auto max-w-6xl" />

      {/* ROLES */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-esmeralda">Tres roles, un gremio</p>
        <h2 className="mt-2 max-w-2xl font-display text-4xl text-tinta">
          Cada quien hace lo que sabe hacer. La plataforma reparte.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              rol: "Propietario",
              pct: "tarifa neta completa",
              tono: "text-esmeralda",
              d: "Fija su tarifa neta y siempre la recibe entera. Único con acceso de escritura al calendario. Vincula de 3 a 5 principales de su confianza. Paga suscripción para publicar.",
              href: "/app/propietario",
            },
            {
              rol: "Comisionista Principal",
              pct: "50% de la comisión",
              tono: "text-oro",
              d: "Recibe las solicitudes sobre sus propiedades vinculadas — el primero en aceptar se la queda. Negocia el precio final con el externo en el módulo formal de ofertas.",
              href: "/app/principal",
            },
            {
              rol: "Comisionista Externo",
              pct: "40% de la comisión",
              tono: "text-oro",
              d: "Trae el cliente — que es suyo, la plataforma jamás lo contacta. Busca disponibilidad real, negocia y reenvía el link de pago. Su reputación vive en su alias.",
              href: "/app/externo",
            },
          ].map((r) => (
            <Link
              key={r.rol}
              href={r.href}
              className="group rounded-2xl border border-borde bg-tarjeta p-7 transition hover:border-esmeralda/40 hover:bg-tarjeta-alta"
            >
              <p className={`cifra text-[11px] font-bold uppercase tracking-[0.18em] ${r.tono}`}>{r.pct}</p>
              <h3 className="mt-3 font-display text-2xl text-tinta">{r.rol}</h3>
              <p className="mt-3 text-sm leading-relaxed text-bruma">{r.d}</p>
              <p className="mt-5 text-sm font-semibold text-esmeralda opacity-0 transition group-hover:opacity-100">
                Ver su panel →
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* MODELO DE DINERO */}
      <section id="modelo" className="border-y border-borde bg-panel/60 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-oro">El modelo de dinero</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl text-tinta">
            Comisión = precio acordado − tarifa neta. Ni un peso escondido.
          </h2>
          <p className="mt-4 max-w-2xl text-bruma">
            Ejemplo real: tarifa neta de <Money valor={1_000_000} className="text-tinta" /> y
            precio negociado de <Money valor={1_200_000} className="text-tinta" /> entre
            Principal y Externo dentro del módulo de negociación.
          </p>

          <div className="mt-12 grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {/* Barra proporcional del split */}
              <div className="flex h-14 overflow-hidden rounded-xl border border-borde font-mono text-[11px] font-bold">
                <div className="flex items-center justify-center bg-esmeralda-tenue text-esmeralda" style={{ width: "83.3%" }}>
                  TARIFA NETA
                </div>
                <div className="flex items-center justify-center bg-oro/80 text-fondo" style={{ width: "8.3%" }}>50</div>
                <div className="flex items-center justify-center bg-oro/55 text-fondo" style={{ width: "6.7%" }}>40</div>
                <div className="flex items-center justify-center bg-oro/30 text-tinta" style={{ width: "1.7%" }} title="App 10%" />
              </div>
              <div className="mt-6 divide-y divide-borde rounded-2xl border border-borde bg-tarjeta">
                {[
                  ["Cliente paga (2 mitades de $600.000)", EJEMPLO.total.precioFinal, "text-tinta font-bold"],
                  ["Comisión acordada", EJEMPLO.total.comision, "text-tinta"],
                  ["→ Comisionista Principal (50%)", EJEMPLO.total.principal, "text-oro"],
                  ["→ Comisionista Externo (40%)", EJEMPLO.total.externo, "text-oro"],
                  ["→ Plataforma (10%)", EJEMPLO.total.app, "text-bruma"],
                  ["Propietario — tarifa neta", EJEMPLO.total.tarifaNeta, "text-esmeralda font-bold"],
                  ["− Pasarela (~3% del total procesado)", -EJEMPLO.total.pasarela, "text-rojo"],
                  ["Propietario neto", EJEMPLO.total.propietarioNeto, "text-esmeralda font-bold"],
                ].map(([k, v, c]) => (
                  <div key={k as string} className="flex items-center justify-between px-6 py-3.5 text-sm">
                    <span className="text-bruma">{k}</span>
                    <Money valor={v as number} className={c as string} />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4 lg:col-span-2">
              {[
                {
                  t: "Cada mitad se reparte sola",
                  d: "Al confirmarse cada pago, la pasarela dispersa directo a cada cuenta bancaria certificada. El dinero nunca pasa por cuentas de la empresa.",
                },
                {
                  t: "Sin piso de comisión al lanzamiento",
                  d: "Prioridad: volumen y adopción. El piso mínimo configurable ya queda programado desde el MVP — apagado hasta que la red se posicione.",
                },
                {
                  t: "Frente a Airbnb",
                  d: "Airbnb cobra 14–16% al anfitrión más ~14% al huésped. Aquí el propietario solo asume el ~3% de pasarela, informado desde el registro.",
                },
              ].map((x) => (
                <div key={x.t} className="rounded-2xl border border-borde bg-tarjeta p-6">
                  <h3 className="font-semibold text-tinta">{x.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-bruma">{x.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRINCIPIOS */}
      <section id="principios" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-esmeralda">No negociables</p>
        <h2 className="mt-2 font-display text-4xl text-tinta">Principios del producto</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPIOS.map((p, i) => (
            <div key={p.t} className="rounded-2xl border border-borde bg-tarjeta p-6">
              <p className="cifra text-xs text-bruma-osc">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 font-display text-xl text-tinta">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-bruma">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FLUJO */}
      <section id="flujo" className="border-y border-borde bg-panel/60 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-oro">Máquina de estados</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl text-tinta">
            De la solicitud a la entrega, sin zonas grises.
          </h2>
          <div className="mt-12 flex flex-wrap items-center gap-2">
            {FLUJO.map((paso, i) => (
              <div key={paso} className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                    paso === "Pago completo ✓"
                      ? "border-esmeralda/40 bg-esmeralda-tenue text-esmeralda"
                      : paso === "Anticipo pagado"
                        ? "border-oro/40 bg-oro-tenue text-oro"
                        : "border-borde-claro bg-tarjeta text-bruma"
                  }`}
                >
                  {paso}
                </span>
                {i < FLUJO.length - 1 && <span className="text-bruma-osc">→</span>}
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-oro/25 bg-oro-tenue/40 p-6">
              <h3 className="font-semibold text-oro">Al entrar el Pago 1</h3>
              <p className="mt-2 text-sm leading-relaxed text-bruma">
                Bloqueo de calendario en firme + Split 1 dispersado. Si dos links
                compiten por las mismas fechas, el primer webhook confirmado gana y
                el otro link se invalida en el mismo instante — la tarjeta del
                segundo cliente nunca se cobra.
              </p>
            </div>
            <div className="rounded-2xl border border-esmeralda/25 bg-esmeralda-tenue/40 p-6">
              <h3 className="font-semibold text-esmeralda">Al entrar el Pago 2</h3>
              <p className="mt-2 text-sm leading-relaxed text-bruma">
                Split 2 dispersado y semáforo en verde: &ldquo;Pago completo ✓&rdquo;. Solo esa
                pantalla autoriza al principal o al propietario a entregar llaves o
                códigos de acceso. Sin verde no hay entrega.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ANONIMATO / ANTI-FUGA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-esmeralda">Identidad y anonimato</p>
            <h2 className="mt-2 font-display text-4xl text-tinta">
              Verificados hasta el hueso.{" "}
              <em className="text-esmeralda">Anónimos en la cancha.</em>
            </h2>
            <p className="mt-5 leading-relaxed text-bruma">
              Registro con cédula, biometría y cuenta bancaria certificada. Adentro,
              cada comisionista opera con un alias autogenerado —{" "}
              <span className="font-mono text-sm text-oro">CONDOR-472</span>,{" "}
              <span className="font-mono text-sm text-oro">CEIBA-118</span> — sin
              relación alguna con sus datos personales. Dos profesionales pueden
              hacer decenas de negocios juntos sin saber jamás quién es el otro.
            </p>
            <p className="mt-4 leading-relaxed text-bruma">
              Intercambiar datos de contacto tiene una sola consecuencia:{" "}
              <span className="font-semibold text-rojo">
                ban perpetuo e inmediato a la identidad
              </span>{" "}
              — cédula y biometría en lista negra permanente, alias retirado para
              siempre, reputación perdida por completo.
            </p>
          </div>
          <div className="rounded-2xl border border-borde bg-tarjeta p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bruma-osc">
              Chat interno · filtro anti-fuga en vivo
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-borde bg-panel px-4 py-3 text-bruma">
                Listo, el cliente confirma 3 noches. ¿Cerramos en $5.100.000?
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm border border-esmeralda/25 bg-esmeralda-tenue px-4 py-3 text-tinta">
                De una. Acepto en el módulo y sale el link.
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-rojo/40 bg-rojo-tenue px-4 py-3">
                <p className="text-bruma line-through">mejor hablemos por wpp, mi número es 310…</p>
                <p className="mt-2 flex items-center gap-2 text-xs font-bold text-rojo">
                  ⛔ MENSAJE BLOQUEADO ANTES DEL ENVÍO
                </p>
                <p className="mt-1 text-[11px] text-bruma">
                  Detectado: canal externo + número telefónico. Intento registrado
                  como evidencia. Reincidencia = ban perpetuo a la identidad.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-borde bg-panel/60">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="mx-auto max-w-3xl font-display text-5xl leading-tight text-tinta">
            Fugarse cuesta más <em className="text-oro">de lo que ahorra.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-bruma">
            Calendario que nunca miente, pago garantizado con split automático,
            contrato autogenerado y una reputación que vale plata. Eso no se
            consigue por WhatsApp.
          </p>
          <Link
            href="/app"
            className="mt-10 inline-block rounded-full bg-esmeralda px-8 py-4 text-sm font-bold text-fondo transition hover:brightness-110"
          >
            Entrar a la demo →
          </Link>
        </div>
        <footer className="border-t border-borde">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-bruma-osc">
            <p className="font-display text-lg text-bruma">ESTADÍA<span className="text-esmeralda">.</span></p>
            <p>Antioquia, Colombia · Piloto Oriente Antioqueño · Demo de producto — no es asesoría legal</p>
          </div>
        </footer>
      </section>
    </main>
  );
}
