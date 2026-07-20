import { PanelComisiones } from "@/components/comisiones";
import { datosComisiones } from "@/server/datos/paneles";

export default async function ComisionesExterno() {
  return <PanelComisiones rol="externo" datos={await datosComisiones("externo")} />;
}
