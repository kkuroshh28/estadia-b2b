import { Card } from "@/components/ui";
import { datosNegociacion } from "@/server/datos/paneles";
import { NegociacionCliente } from "./negociacion-cliente";

export default async function ModuloNegociacion() {
  const datos = await datosNegociacion();
  if (!datos.negociacion) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-3xl text-tinta">Módulo de negociación</h1>
        <Card className="p-8 text-sm leading-relaxed text-bruma">
          No tienes negociaciones abiertas. Cuando aceptes una solicitud (o un
          principal acepte la tuya), la negociación formal se abre aquí: ofertas
          con vigencia, desglose en vivo y registro inmutable.
        </Card>
      </div>
    );
  }
  return <NegociacionCliente datos={datos} />;
}
