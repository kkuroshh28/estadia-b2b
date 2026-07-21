import { datosCalendario } from "@/server/datos/paneles";
import { CalendarioCliente } from "./calendario-cliente";

export default async function CalendarioPropietario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const datos = await datosCalendario(mes);
  return <CalendarioCliente datos={datos} />;
}
