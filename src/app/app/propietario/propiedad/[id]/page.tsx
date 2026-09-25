import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Cover, Money } from "@/components/ui";
import { Galeria } from "@/components/galeria";
import { FichaComercial } from "@/components/ficha-comercial";
import { lineaDeFicha } from "@/lib/domain/ficha";
import { calcularNetoPropietario } from "@/lib/domain/split";
import { datosFichaPropietario } from "@/server/datos/paneles";
import { PublicarBoton } from "../../publicar-boton";

/** Ficha de una propiedad propia: fotos, datos comerciales, tarifa y publicación. */
export default async function FichaPropietario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = await datosFichaPropietario(id);
  if (!datos) notFound();
  const { propiedad: p } = datos;
  const fotos = p.fotos ?? [];
  const neto = calcularNetoPropietario(p.tarifaNetaNoche);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link href="/app/propietario" className="text-xs font-semibold text-bruma transition hover:text-tinta">
        ← Mis propiedades
      </Link>

      {fotos.length > 0 ? (
        <Galeria fotos={fotos} nombre={p.nombre} />
      ) : (
        <Cover matiz={p.matiz} className="h-44 rounded-2xl sm:h-56" />
      )}

      <Card className="flex flex-wrap items-start justify-between gap-5 p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl text-tinta">{p.nombre}</h1>
            {p.verificada ? <Badge tono="esmeralda">Verificada</Badge> : <Badge tono="ambar">En revisión</Badge>}
            {p.ownerDirect && <Badge tono="azul">Gestión directa</Badge>}
            <Badge tono={p.publicada ? "esmeralda" : "neutro"}>{p.publicada ? "Publicada" : "No publicada"}</Badge>
          </div>
          <p className="mt-1 text-sm text-bruma">{lineaDeFicha(p)}</p>
          {p.ownerDirect && (
            <p className="mt-2 text-xs text-bruma-osc">
              Solo tú atiendes y negocias las solicitudes de esta propiedad.
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-bruma-osc">Tarifa neta / noche</p>
          {p.tarifaNetaNoche > 0 ? (
            <>
              <Money valor={p.tarifaNetaNoche} className="text-2xl font-bold text-esmeralda" />
              <p className="text-[10px] text-bruma-osc">
                recibes <Money valor={neto.recibe} /> tras pasarela
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-oro">Sin tarifa definida</p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <Link
              href={`/app/propietario/calendario?propiedad=${p.id}`}
              className="rounded-full bg-tiffany px-4 py-2 text-[11px] font-bold text-noche transition hover:bg-tiffany-claro"
            >
              {p.tarifaNetaNoche > 0 ? "Calendario y tarifa" : "Definir tarifa"}
            </Link>
            <PublicarBoton propiedadId={p.id} publicada={p.publicada ?? false} />
          </div>
        </div>
      </Card>

      <FichaComercial propiedad={p} />
    </div>
  );
}
