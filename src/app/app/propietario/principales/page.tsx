import { datosPrincipales } from "@/server/datos/paneles";
import { PrincipalesCliente } from "./principales-cliente";

export default async function GestionPrincipales() {
  const datos = await datosPrincipales();
  return <PrincipalesCliente datos={datos} />;
}
