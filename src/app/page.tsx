import Link from "next/link";
import { Badge, Money } from "@/components/ui";
import { Reveal, RevealHero } from "@/components/motion";
import { FlujoDinero } from "@/components/flujo-dinero";
import { calcularSplit } from "@/lib/domain/split";

const EJEMPLO = calcularSplit(1_200_000, 1_000_000);

const REGLAS_DE_ORO = [
  {
    t: "El primero que paga, gana",
    d: "Sin holds ni reservas tentativas. El calendario solo se bloquea cuando entra el Pago 1, confirmado por webhook en tiempo real. Si dos links compiten, el primero invalida el otro al instante.",
  },
  {
    t: "Tarifa neta intocable",
    d: "El propietario fija su tarifa y siempre la recibe completa. La comisión se negocia por encima, jamás se descuenta de ella. Su único costo: el ~3% de pasarela, informado desde el registro.",
  },
  {
    t: "Pago 50/50, siempre tarjeta",
    d: "50% para reservar, 50% el día de ingreso. Cada mitad se dispersa automáticamente al entrar, sin retenciones. Efectivo prohibido en cualquier punto del flujo.",
  },
  {
    t: "Identidad verificada, operación anónima",
    d: "KYC con cédula y biometría para entrar; adentro, cada comisionista opera con un alias autogenerado, único e irrepetible. Nadie ve nombres, fotos ni teléfonos reales.",
  },
  {
    t: "Todo pasa dentro de la app",
    d: "Chat, negociación y coordinación son internos. Intercambiar datos de contacto = ban perpetuo a la identidad — cédula y biometría en lista negra permanente.",
  },
  {
    t: "Sin verde no hay entrega",
    d: "El semáforo de pagos en tiempo real es la única autorización para entregar llaves o códigos. Sin “Pago completo ✓”, la propiedad no se entrega.",
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
      {/* BANDA TERCIOPELO: nav + hero — la joya Tiffany sobre el fondo profundo */}
      <div className="terciopelo">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-display text-2xl text-tinta">
          THE CIRCLE<span className="text-white">.</span>
        </p>
        <div className="hidden items-center gap-8 text-sm text-tinta/75 sm:flex">
          <a href="#modelo" className="transition hover:text-tinta">Modelo</a>
          <a href="#reglas" className="transition hover:text-tinta">Reglas</a>
          <a href="#confianza" className="transition hover:text-tinta">Confianza</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="hidden rounded-full border border-tinta/30 px-5 py-2 text-sm font-semibold text-tinta transition hover:bg-white/50 sm:block"
          >
            Ver demo
          </Link>
          <Link
            href="/registro"
            className="rounded-full bg-tinta px-5 py-2 text-sm font-bold text-white transition hover:bg-tinta/85"
          >
            Crear cuenta
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="mx-auto max-w-6xl px-6 pb-20 pt-12 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <RevealHero>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tono="esmeralda" vivo>Piloto · Oriente Antioqueño</Badge>
                <Badge tono="oro">100% B2B</Badge>
              </div>
            </RevealHero>
            <RevealHero delay={0.08}>
              <h1 className="mt-6 font-display text-4xl leading-[1.05] text-tinta sm:text-6xl">
                La app no te quita tu cliente.{" "}
                <em className="rounded-xl bg-white/80 px-2 text-tinta">Te da inventario.</em>
              </h1>
            </RevealHero>
            <RevealHero delay={0.16}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-tinta/85">
                La red que conecta propietarios de rentas cortas en Antioquia con su
                gremio de comisionistas. Calendario que nunca miente, negociación con
                las cartas sobre la mesa y split automático en cada pago. El cliente
                final nunca entra: solo recibe un link.
              </p>
            </RevealHero>
            <RevealHero delay={0.24}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/registro"
                  className="rounded-full bg-tinta px-7 py-3.5 text-sm font-bold text-white transition hover:bg-tinta/85"
                >
                  Empezar registro →
                </Link>
                <Link
                  href="/app"
                  className="rounded-full border border-tinta/35 px-7 py-3.5 text-sm font-semibold text-tinta transition hover:bg-white/50"
                >
                  Explorar la demo
                </Link>
              </div>
            </RevealHero>
          </div>
          <RevealHero delay={0.2}>
            <FlujoDinero />
          </RevealHero>
        </div>

        <RevealHero delay={0.1}>
          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-borde bg-borde sm:grid-cols-4">
            {[
              ["50 / 40 / 10", "split de la comisión"],
              ["~3%", "único costo del propietario"],
              ["1 noche – 3 meses", "rentas cortas únicamente"],
              ["0 holds", "sin reservas tentativas"],
            ].map(([v, k]) => (
              <div key={k} className="bg-panel px-6 py-5">
                <p className="cifra text-xl font-bold text-tinta">{v}</p>
                <p className="mt-1 text-xs text-bruma">{k}</p>
              </div>
            ))}
          </div>
        </RevealHero>
      </header>
      </div>
      {/* fin banda terciopelo */}

      {/* ROLES — 3 caminos */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-esmeralda">Tres roles, un gremio</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl text-tinta">
            Cada quien hace lo que sabe hacer. La plataforma reparte.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              rol: "Propietario",
              pct: "tarifa neta completa",
              tono: "text-esmeralda",
              d: "Fija su tarifa neta y siempre la recibe entera. Único con acceso de escritura al calendario. Vincula de 3 a 5 principales de su confianza. Paga suscripción para publicar.",
              demo: "/app/propietario",
            },
            {
              rol: "Comisionista Principal",
              pct: "50% de la comisión",
              tono: "text-oro",
              d: "Recibe las solicitudes sobre sus propiedades vinculadas — el primero en aceptar se la queda. Negocia el precio final con el externo en el módulo formal de ofertas.",
              demo: "/app/principal",
            },
            {
              rol: "Comisionista Externo",
              pct: "40% de la comisión",
              tono: "text-oro",
              d: "Trae el cliente — que es suyo, la plataforma jamás lo contacta. Busca disponibilidad real, negocia y reenvía el link de pago. Su reputación vive en su alias.",
              demo: "/app/externo",
            },
          ].map((r, i) => (
            <Reveal key={r.rol} delay={i * 0.1}>
              <div className="group flex h-full flex-col rounded-2xl border border-borde bg-tarjeta p-7 transition hover:border-tiffany hover:bg-tarjeta-alta">
                <p className={`cifra text-[11px] font-bold uppercase tracking-[0.18em] ${r.tono}`}>{r.pct}</p>
                <h3 className="mt-3 font-display text-2xl text-tinta">{r.rol}</h3>
                <p className="mt-3 text-sm leading-relaxed text-bruma">{r.d}</p>
                <div className="mt-auto flex gap-3 pt-6">
                  <Link
                    href={`/registro?rol=${encodeURIComponent(r.rol)}`}
                    className="rounded-full bg-tiffany px-4 py-2 text-xs font-bold text-tinta transition hover:bg-tiffany"
                  >
                    Registrarme
                  </Link>
                  <Link
                    href={r.demo}
                    className="rounded-full border border-borde-claro px-4 py-2 text-xs font-semibold text-bruma transition hover:text-tinta"
                  >
                    Ver su panel
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* MODELO DE DINERO */}
      <section id="modelo" className="border-y border-borde bg-tiffany-bruma/50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-oro">El modelo de dinero</p>
            <h2 className="mt-2 max-w-2xl font-display text-4xl text-tinta">
              Comisión = precio acordado − tarifa neta. Ni un peso escondido.
            </h2>
            <p className="mt-4 max-w-2xl text-bruma">
              Ejemplo real: tarifa neta de <Money valor={1_000_000} className="text-tinta" /> y
              precio negociado de <Money valor={1_200_000} className="text-tinta" /> entre
              Principal y Externo dentro del módulo de negociación.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-8 lg:grid-cols-5">
            <Reveal className="lg:col-span-3">
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
            </Reveal>
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
              ].map((x, i) => (
                <Reveal key={x.t} delay={i * 0.08}>
                  <div className="rounded-2xl border border-borde bg-tarjeta p-6">
                    <h3 className="font-semibold text-tinta">{x.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-bruma">{x.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* REGLAS DE ORO */}
      <section id="reglas" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-esmeralda">No negociables</p>
          <h2 className="mt-2 font-display text-4xl text-tinta">Las reglas de oro</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REGLAS_DE_ORO.map((p, i) => (
            <Reveal key={p.t} delay={(i % 3) * 0.08}>
              <div className="h-full rounded-2xl border border-borde bg-tarjeta p-6">
                <p className="cifra text-xs text-bruma-osc">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 font-display text-xl text-tinta">{p.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-bruma">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FLUJO DE ESTADOS */}
      <section className="border-y border-borde bg-tiffany-bruma/50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-oro">Máquina de estados</p>
            <h2 className="mt-2 max-w-2xl font-display text-4xl text-tinta">
              De la solicitud a la entrega, sin zonas grises.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
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
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-oro/25 bg-oro-tenue/40 p-6">
                <h3 className="font-semibold text-oro">Al entrar el Pago 1</h3>
                <p className="mt-2 text-sm leading-relaxed text-bruma">
                  Bloqueo de calendario en firme + Split 1 dispersado. Si dos links
                  compiten por las mismas fechas, el primer webhook confirmado gana y
                  el otro link se invalida en el mismo instante — la tarjeta del
                  segundo cliente nunca se cobra.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-2xl border border-tiffany-claro bg-tiffany-bruma/40 p-6">
                <h3 className="font-semibold text-esmeralda">Al entrar el Pago 2</h3>
                <p className="mt-2 text-sm leading-relaxed text-bruma">
                  Split 2 dispersado y semáforo en verde: &ldquo;Pago completo ✓&rdquo;. Solo esa
                  pantalla autoriza al principal o al propietario a entregar llaves o
                  códigos de acceso. Sin verde no hay entrega.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CONFIANZA + ANTI-FUGA */}
      <section id="confianza" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-esmeralda">Confianza estructural</p>
              <h2 className="mt-2 font-display text-4xl text-tinta">
                Verificados hasta el hueso.{" "}
                <em className="text-esmeralda">Anónimos en la cancha.</em>
              </h2>
              <p className="mt-5 leading-relaxed text-bruma">
                Registro con cédula, biometría y cuenta bancaria certificada.
                Propiedades con certificado de tradición y libertad → sello{" "}
                <span className="font-semibold text-esmeralda">Propiedad Verificada</span>.
                Adentro, cada comisionista opera con un alias —{" "}
                <span className="font-mono text-sm text-tinta">CONDOR-472</span>,{" "}
                <span className="font-mono text-sm text-tinta">CEIBA-118</span> — sin
                relación alguna con sus datos personales.
              </p>
              <p className="mt-4 leading-relaxed text-bruma">
                Intercambiar datos de contacto tiene una sola consecuencia:{" "}
                <span className="font-semibold text-rojo">
                  ban perpetuo e inmediato a la identidad
                </span>{" "}
                — cédula y biometría en lista negra permanente, alias retirado para
                siempre, reputación perdida por completo.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.12}>
            <div className="rounded-2xl border border-borde bg-tarjeta p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bruma-osc">
                Chat interno · filtro anti-fuga en vivo
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-borde bg-panel px-4 py-3 text-bruma">
                  Listo, el cliente confirma 3 noches. ¿Cerramos en $5.100.000?
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm border border-tiffany-claro bg-tiffany-bruma px-4 py-3 text-tinta">
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
              <Link
                href="/app/chat"
                className="mt-4 inline-block text-xs font-semibold text-esmeralda hover:underline"
              >
                Probar el filtro en la demo →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL — banda terciopelo de cierre */}
      <section className="terciopelo">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-3xl font-display text-5xl leading-tight text-tinta">
              Fugarse cuesta más <em className="rounded-xl bg-white/80 px-2">de lo que ahorra.</em>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-tinta/85">
              Calendario que nunca miente, pago garantizado con split automático,
              contrato autogenerado y una reputación que vale plata. Eso no se
              consigue por WhatsApp.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/registro"
                className="rounded-full bg-tinta px-8 py-4 text-sm font-bold text-white transition hover:bg-tinta/85"
              >
                Crear mi cuenta →
              </Link>
              <Link
                href="/app"
                className="rounded-full border border-tinta/35 px-8 py-4 text-sm font-semibold text-tinta transition hover:bg-white/50"
              >
                Ver la demo
              </Link>
            </div>
          </Reveal>
        </div>
        <footer className="border-t border-tinta/15">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-tinta/70">
            <p className="font-display text-lg text-tinta">THE CIRCLE<span className="text-white">.</span></p>
            <p>Antioquia, Colombia · Piloto Oriente Antioqueño · Demo de producto — no es asesoría legal</p>
          </div>
        </footer>
      </section>
    </main>
  );
}
