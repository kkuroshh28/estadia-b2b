import { datosCalendario } from "@/server/datos/paneles";
import { CalendarioCliente } from "./calendario-cliente";

export default async function CalendarioPropietario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; propiedad?: string }>;
}) {
  const { mes, propiedad } = await searchParams;
  const datos = await datosCalendario(mes);
  return <CalendarioCliente datos={datos} propiedadInicial={propiedad} />;
}
