import Link from "next/link";
import { Badge, Card, Cover, Money, Stat } from "@/components/ui";
import { MoneyAnimado } from "@/components/motion";
import { Semaforo } from "@/components/semaforo";
import { GraficaIngresos } from "@/components/grafica-ingresos";
import { PROPIEDADES, RESERVAS, propiedadPorId } from "@/lib/data/demo";
import { calcularNetoPropietario } from "@/lib/domain/split";

export default function PanelPropietario() {
  const activas = RESERVAS.filter((r) => r.estado !== "COMPLETADA");
  const netoJulio = 8_960_000;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="font-display text-3xl text-tinta">Panel del propietario</h1>
        <p className="mt-1 text-sm text-bruma">
          Tu tarifa neta siempre llega completa. El único costo es el ~3% de pasarela.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          etiqueta="Neto recibido · julio"
          valor={<MoneyAnimado valor={netoJulio} />}
          detalle="Dispersión directa a tu cuenta certificada"
          tono="esmeralda"
        />
        <Stat
          etiqueta="Reservas activas"
          valor={activas.length}
          detalle="2 con pago en curso · 1 esperando anticipo"
        />
        <Stat
          etiqueta="Suscripción"
          valor="Activa"
          detalle="Renueva el 1 de agosto · tus propiedades están visibles"
          tono="oro"
        />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-tinta">Neto mensual 2026</h2>
          <Badge tono="esmeralda">Tarifa neta completa · −3% pasarela</Badge>
        </div>
        <div className="mt-4">
          <GraficaIngresos />
        </div>
      </Card>

      {/* PROPIEDADES */}
      <section>
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl text-tinta">Mis propiedades</h2>
          <Link href="/app/propietario/calendario" className="text-sm font-semibold text-esmeralda hover:underline">
            Calendario y tarifa →
          </Link>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROPIEDADES.slice(0, 6).map((p) => {
            const neto = calcularNetoPropietario(p.tarifaNetaNoche);
            return (
              <Card key={p.id} className="overflow-hidden">
                <Cover matiz={p.matiz} className="h-28" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold leading-tight text-tinta">{p.nombre}</h3>
                      <p className="mt-0.5 text-xs text-bruma">
                        {p.municipio} · {p.zona} · {p.capacidad} personas
                      </p>
                    </div>
                    {p.verificada ? (
                      <Badge tono="esmeralda">Verificada</Badge>
                    ) : (
                      <Badge tono="ambar">En revisión</Badge>
                    )}
                  </div>
                  <div className="mt-4 flex items-end justify-between border-t border-borde pt-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma-osc">
                        Tarifa neta / noche
                      </p>
                      <Money valor={p.tarifaNetaNoche} className="text-base font-bold text-esmeralda" />
                      <p className="text-[10px] text-bruma-osc">
                        recibes <Money valor={neto.recibe} /> tras pasarela
                      </p>
                    </div>
                    <p className="text-[11px] text-bruma">
                      {p.principalesVinculados}/5 principales
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* RESERVAS CON SEMÁFORO */}
      <section>
        <h2 className="font-display text-2xl text-tinta">Reservas · semáforo de pagos</h2>
        <p className="mt-1 text-sm text-bruma">
          Sin &ldquo;Pago completo ✓&rdquo; no hay entrega de llaves ni códigos. Regla absoluta.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {RESERVAS.map((r) => (
            <Semaforo key={r.id} reserva={r} propiedadNombre={propiedadPorId(r.propiedadId).nombre} />
          ))}
        </div>
      </section>
    </div>
  );
}
