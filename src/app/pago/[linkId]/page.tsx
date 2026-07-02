import { Money } from "@/components/ui";
import { LINKS_DE_PAGO } from "@/lib/data/demo";

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
  const muerto = link.estado === "invalidado" || link.estado === "expirado";
  const pagado = link.estado === "pagado";

  return (
    <main className="atmosfera flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <p className="font-display text-2xl text-tinta">
        ESTADÍA<span className="text-esmeralda">.</span>
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-bruma-osc">
        Pago seguro con tarjeta
      </p>

      <div className="mt-8 w-full max-w-md rounded-3xl border border-borde bg-tarjeta p-8">
        {muerto ? (
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-rojo/40 bg-rojo-tenue text-2xl">
              ✕
            </div>
            <h1 className="mt-5 font-display text-2xl text-tinta">
              Fechas ya no disponibles
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-bruma">
              Este link de pago ya no está activo y tu tarjeta no fue cobrada.
              Contacta a tu asesor para buscar nuevas fechas u otra propiedad.
            </p>
          </div>
        ) : pagado ? (
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-esmeralda/40 bg-esmeralda-tenue text-2xl text-esmeralda">
              ✓
            </div>
            <h1 className="mt-5 font-display text-2xl text-tinta">Pago confirmado</h1>
            <p className="mt-3 text-sm leading-relaxed text-bruma">
              Recibimos tu pago de <Money valor={link.monto} className="font-bold text-tinta" />.
              El comprobante llegó a tu correo y a tu celular.
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-borde pb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bruma-osc">
                Tu reserva
              </p>
              <h1 className="mt-1 font-display text-2xl text-tinta">{link.propiedadNombre}</h1>
              <p className="mt-1 text-sm text-bruma">
                {link.fechas.desde} → {link.fechas.hasta}
              </p>
            </div>
            <div className="flex items-center justify-between py-5">
              <div>
                <p className="text-sm text-bruma">
                  {link.mitad === 1 ? "Anticipo para reservar (50%)" : "Saldo — día de ingreso (50%)"}
                </p>
                <p className="text-[11px] text-bruma-osc">Link válido hasta {link.vence}</p>
              </div>
              <Money valor={link.monto} className="text-2xl font-bold text-tinta" />
            </div>
            <div className="space-y-3">
              <input
                disabled
                placeholder="Número de tarjeta"
                className="w-full rounded-xl border border-borde bg-panel px-4 py-3 text-sm text-tinta placeholder:text-bruma-osc"
              />
              <div className="flex gap-3">
                <input
                  disabled
                  placeholder="MM/AA"
                  className="w-1/2 rounded-xl border border-borde bg-panel px-4 py-3 text-sm placeholder:text-bruma-osc"
                />
                <input
                  disabled
                  placeholder="CVC"
                  className="w-1/2 rounded-xl border border-borde bg-panel px-4 py-3 text-sm placeholder:text-bruma-osc"
                />
              </div>
              <button
                disabled
                className="w-full cursor-not-allowed rounded-xl bg-esmeralda py-3.5 text-sm font-bold text-fondo opacity-80"
                title="Demo — la pasarela real (Wompi/MercadoPago/PayU) se conecta en Fase 0"
              >
                Pagar <Money valor={link.monto} />
              </button>
              <p className="text-center text-[10px] leading-relaxed text-bruma-osc">
                Demo de producto. En producción este botón procesa con la pasarela y
                el webhook confirma en tiempo real: si alguien paga estas fechas
                primero, este link se invalida y tu tarjeta no se cobra.
              </p>
            </div>
          </>
        )}
      </div>

      <p className="mt-6 text-[11px] text-bruma-osc">
        ¿Dudas con tu reserva? Escríbele a tu asesor de confianza.
      </p>
    </main>
  );
}
