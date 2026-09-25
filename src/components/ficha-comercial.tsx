import type { Propiedad } from "@/lib/domain/tipos";
import { Card } from "@/components/ui";

/**
 * Ficha comercial de la propiedad: resumen, cifras clave, descripción y
 * secciones (experiencia, servicios, zonas comunes…). Solo pinta lo que la
 * propiedad tenga cargado.
 */
export function FichaComercial({ propiedad }: { propiedad: Propiedad }) {
  const datosClave = propiedad.datosClave ?? [];
  const secciones = propiedad.secciones ?? [];
  const videos = propiedad.videos ?? [];
  const hayTexto = propiedad.resumen || propiedad.descripcion || propiedad.nota;
  if (!hayTexto && datosClave.length === 0 && secciones.length === 0 && videos.length === 0) return null;

  return (
    <div className="space-y-6">
      {datosClave.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {datosClave.map((d) => (
            <Card key={`${d.valor}-${d.etiqueta}`} className="p-4">
              <p className="cifra font-display text-2xl text-tiffany">{d.valor}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-bruma">{d.etiqueta}</p>
            </Card>
          ))}
        </div>
      )}

      {hayTexto && (
        <Card className="space-y-4 p-6">
          {propiedad.resumen && <p className="text-base leading-relaxed text-tinta">{propiedad.resumen}</p>}
          {propiedad.descripcion && (
            <p className="text-sm leading-relaxed text-bruma">{propiedad.descripcion}</p>
          )}
          {propiedad.nota && (
            <p className="border-t border-borde pt-3 text-xs text-bruma-osc">{propiedad.nota}</p>
          )}
        </Card>
      )}

      {videos.length > 0 && (
        <Card className="p-6">
          <h2 className="font-display text-lg text-tinta">Recorrido en video</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {videos.map((src) => (
              <video
                key={src}
                src={src}
                poster={src.replace(/\.mp4$/, ".webp")}
                controls
                playsInline
                preload="metadata"
                className="aspect-[3/4] w-full rounded-xl bg-panel object-cover"
              />
            ))}
          </div>
        </Card>
      )}

      {secciones.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {secciones.map((s) => (
            <Card key={s.titulo} className="p-6">
              <h2 className="font-display text-lg text-tinta">{s.titulo}</h2>
              <ul className="mt-3 space-y-2 text-sm text-bruma">
                {s.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-tiffany" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
