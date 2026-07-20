import { PanelComisiones } from "@/components/comisiones";
import { datosComisiones } from "@/server/datos/paneles";

export default async function ComisionesPrincipal() {
  return <PanelComisiones rol="principal" datos={await datosComisiones("principal")} />;
}
