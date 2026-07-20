import { datosCalendario } from "@/server/datos/paneles";
import { CalendarioCliente } from "./calendario-cliente";

export default async function CalendarioPropietario() {
  const datos = await datosCalendario();
  return <CalendarioCliente datos={datos} />;
}
