import { notFound } from "next/navigation";
import { datosFicha } from "@/server/datos/paneles";
import { FichaPropiedad } from "@/components/ficha-propiedad";

/** Ficha técnica de propiedad — la vista del Externo para VENDER. */
export default async function PaginaFicha({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { id } = await params;
  const { mes } = await searchParams;
  const datos = await datosFicha(id, mes);
  if (!datos) notFound();
  return <FichaPropiedad datos={datos} />;
}
