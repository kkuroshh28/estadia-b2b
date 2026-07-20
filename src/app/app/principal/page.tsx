import { datosPrincipal } from "@/server/datos/paneles";
import { PanelPrincipalCliente } from "./panel-cliente";

export default async function PanelPrincipal() {
  const datos = await datosPrincipal();
  return <PanelPrincipalCliente datos={datos} />;
}
