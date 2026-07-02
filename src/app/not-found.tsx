import Link from "next/link";

export default function NoEncontrada() {
  return (
    <main className="atmosfera flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-2xl text-tinta">
        ESTADÍA<span className="text-esmeralda">.</span>
      </p>
      <p className="cifra mt-8 text-6xl font-bold text-borde-claro">404</p>
      <h1 className="mt-3 font-display text-3xl text-tinta">Esta página no existe</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-bruma">
        El enlace puede estar vencido o mal escrito. Si te lo compartió un asesor,
        pídele que lo genere de nuevo desde la app.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="rounded-full bg-esmeralda px-6 py-3 text-sm font-bold text-fondo transition hover:brightness-110"
        >
          Ir al inicio
        </Link>
        <Link
          href="/app"
          className="rounded-full border border-borde-claro px-6 py-3 text-sm font-semibold text-bruma transition hover:text-tinta"
        >
          Abrir la demo
        </Link>
      </div>
    </main>
  );
}
