import { eq } from "drizzle-orm";
import { Checkout } from "@/components/checkout";
import { LINKS_DE_PAGO, RESERVAS } from "@/lib/data/demo";
import { obtenerDb } from "@/server/db";
import { linksDePago, propiedades, reservas } from "@/server/db/schema";
import { hayDb } from "@/server/datos/fuente";
import type { LinkDePago } from "@/lib/domain/tipos";

/**
 * Checkout del cliente final (§8.5) — web, FUERA de la app.
 * El cliente no es usuario: solo ve propiedad, fechas y el monto de su mitad.
 * Sin desgloses, sin tarifa neta, sin comisiones. Jamás.
 * Con DB el link es REAL (y el pago entra por el webhook); sin DB, demo.
 */

async function linkReal(linkId: string): Promise<{ link: LinkDePago; netaMitad: number } | null> {
  const db = obtenerDb();
  const [fila] = await db
    .select({
      id: linksDePago.id,
      reservaId: linksDePago.reservaId,
      mitad: linksDePago.mitad,
      monto: linksDePago.montoCentavos,
      estado: linksDePago.estado,
      venceEn: linksDePago.venceEn,
      codigo: reservas.codigo,
      desde: reservas.desde,
      hasta: reservas.hasta,
      tarifaNeta: reservas.tarifaNetaCentavos,
      propiedadNombre: propiedades.nombre,
    })
    .from(linksDePago)
    .innerJoin(reservas, eq(linksDePago.reservaId, reservas.id))
    .innerJoin(propiedades, eq(reservas.propiedadId, propiedades.id))
    .where(eq(linksDePago.id, linkId));
  if (!fila) return null;
  const vence = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  }).format(fila.venceEn);
  return {
    link: {
      id: fila.id,
      reservaId: fila.reservaId,
      codigoReserva: fila.codigo,
      propiedadNombre: fila.propiedadNombre,
      mitad: fila.mitad as 1 | 2,
      monto: Math.round(fila.monto / 100),
      estado: fila.estado,
      vence,
      fechas: { desde: fila.desde, hasta: fila.hasta },
    },
    netaMitad: Math.round(fila.tarifaNeta / 200),
  };
}

export default async function CheckoutCliente({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = await params;

  let link: LinkDePago | undefined;
  let tarifaNetaMitad = 0;
  let real = false;

  if (hayDb()) {
    const r = await linkReal(linkId).catch(() => null);
    if (r) {
      link = r.link;
      tarifaNetaMitad = r.netaMitad;
      real = true;
    }
  }
  if (!link) {
    link = LINKS_DE_PAGO.find((l) => l.id === linkId) ?? LINKS_DE_PAGO[0];
    const reserva = RESERVAS.find((r) => r.id === link!.reservaId);
    tarifaNetaMitad = reserva
      ? Math.round(reserva.tarifaNetaTotal / 2)
      : Math.round(link.monto * 0.85);
  }

  return (
    <main className="atmosfera flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <p className="font-display text-2xl text-tinta">
        THE CIRCLE<span className="text-tiffany">.</span>
      </p>
      <p className="mb-8 mt-1 text-[11px] uppercase tracking-[0.22em] text-bruma-osc">
        Pago seguro con tarjeta
      </p>
      <Checkout link={link} tarifaNetaMitad={tarifaNetaMitad} real={real} />
      <p className="mt-6 text-[11px] text-bruma-osc">
        ¿Dudas con tu reserva? Escríbele a tu asesor de confianza.
      </p>
    </main>
  );
}
