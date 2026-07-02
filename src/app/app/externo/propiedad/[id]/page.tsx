import { notFound } from "next/navigation";
import { PROPIEDADES } from "@/lib/data/demo";
import { FichaPropiedad } from "@/components/ficha-propiedad";

/** Ficha técnica de propiedad — la vista del Externo para VENDER. */
export default async function PaginaFicha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const propiedad = PROPIEDADES.find((p) => p.id === id);
  if (!propiedad) notFound();
  return <FichaPropiedad propiedad={propiedad} />;
}
