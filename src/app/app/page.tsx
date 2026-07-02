import Link from "next/link";
import { Card } from "@/components/ui";

const ROLES = [
  {
    href: "/app/propietario",
    rol: "Propietario",
    d: "Tus propiedades, tu calendario, tu tarifa neta. Semáforo de pagos de cada reserva.",
    kpi: "Recibe el 100% de su tarifa",
  },
  {
    href: "/app/principal",
    rol: "Comisionista Principal",
    d: "Bandeja de solicitudes en tiempo real y módulo de negociación con desglose en vivo.",
    kpi: "50% de la comisión",
  },
  {
    href: "/app/externo",
    rol: "Comisionista Externo",
    d: "Búsqueda con disponibilidad real, tarifa neta visible y links de pago para tu cliente.",
    kpi: "40% de la comisión",
  },
];

export default function HubRoles() {
  return (
    <div className="mx-auto max-w-4xl py-10">
      <h1 className="font-display text-4xl text-tinta">¿Desde qué rol quieres ver la plataforma?</h1>
      <p className="mt-3 text-bruma">
        En producción cada usuario entra con KYC verificado y ve únicamente su rol.
        Esta demo te deja recorrer los tres.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {ROLES.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="h-full p-6 transition hover:border-esmeralda/40 hover:bg-tarjeta-alta">
              <p className="cifra text-[11px] font-bold uppercase tracking-wider text-oro">{r.kpi}</p>
              <h2 className="mt-2 font-display text-xl text-tinta">{r.rol}</h2>
              <p className="mt-2 text-sm leading-relaxed text-bruma">{r.d}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
