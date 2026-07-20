import { notFound } from "next/navigation";
import { datosFicha } from "@/server/datos/paneles";
import { FichaPropiedad } from "@/components/ficha-propiedad";

/** Ficha técnica de propiedad — la vista del Externo para VENDER. */
export default async function PaginaFicha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const datos = await datosFicha(id);
  if (!datos) notFound();
  return (
    <FichaPropiedad
      propiedad={datos.propiedad}
      mesTitulo={datos.mesTitulo}
      diasDelMes={datos.diasDelMes}
      offsetLunes={datos.offsetLunes}
      ocupados={datos.ocupados}
    />
  );
}
