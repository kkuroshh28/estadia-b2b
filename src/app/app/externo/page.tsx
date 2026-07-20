import { datosBusquedaExterno } from "@/server/datos/paneles";
import { BusquedaExternoCliente } from "./busqueda-cliente";

export default async function BusquedaExterno() {
  const datos = await datosBusquedaExterno();
  return <BusquedaExternoCliente datos={datos} />;
}
