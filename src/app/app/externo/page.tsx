import { datosBusquedaExterno } from "@/server/datos/paneles";
import { BusquedaExternoCliente } from "./busqueda-cliente";

export default async function BusquedaExterno({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const datos = await datosBusquedaExterno(desde, hasta);
  return <BusquedaExternoCliente datos={datos} />;
}
