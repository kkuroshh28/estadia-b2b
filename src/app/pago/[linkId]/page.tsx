import { Checkout } from "@/components/checkout";
import { LINKS_DE_PAGO, RESERVAS } from "@/lib/data/demo";

/**
 * Checkout del cliente final (§8.5) — web, FUERA de la app.
 * El cliente no es usuario: solo ve propiedad, fechas y el monto de su mitad.
 * Sin desgloses, sin tarifa neta, sin comisiones. Jamás.
 */
export default async function CheckoutCliente({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = await params;
  const link = LINKS_DE_PAGO.find((l) => l.id === linkId) ?? LINKS_DE_PAGO[0];
  const reserva = RESERVAS.find((r) => r.id === link.reservaId);
  const tarifaNetaMitad = reserva
    ? Math.round(reserva.tarifaNetaTotal / 2)
    : Math.round(link.monto * 0.85);

  return (
    <main className="atmosfera flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <p className="font-display text-2xl text-tinta">
        ESTADÍA<span className="text-tiffany">.</span>
      </p>
      <p className="mb-8 mt-1 text-[11px] uppercase tracking-[0.22em] text-bruma-osc">
        Pago seguro con tarjeta
      </p>
      <Checkout link={link} tarifaNetaMitad={tarifaNetaMitad} />
      <p className="mt-6 text-[11px] text-bruma-osc">
        ¿Dudas con tu reserva? Escríbele a tu asesor de confianza.
      </p>
    </main>
  );
}
