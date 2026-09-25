"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";

/**
 * Galería de la propiedad: mosaico de portada (1 grande + 4) y visor a
 * pantalla completa con teclado (← → Esc) y gestos de toque.
 */
export function Galeria({ fotos, nombre }: { fotos: string[]; nombre: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const total = fotos.length;

  const mover = useCallback(
    (delta: number) => setAbierta((i) => (i === null ? i : (i + delta + total) % total)),
    [total],
  );

  useEffect(() => {
    if (abierta === null) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(null);
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", tecla);
    };
  }, [abierta, mover]);

  if (total === 0) return null;
  const mosaico = fotos.slice(0, 5);

  return (
    <>
      <div className="relative grid h-64 grid-cols-4 grid-rows-2 gap-1.5 overflow-hidden rounded-2xl sm:h-96">
        {mosaico.map((src, i) => (
          <button
            key={src}
            onClick={() => setAbierta(i)}
            aria-label={`Ver foto ${i + 1} de ${total}`}
            className={`group relative overflow-hidden bg-tarjeta ${
              i === 0 ? "col-span-4 row-span-2 sm:col-span-2" : "hidden sm:block"
            }`}
          >
            <Image
              src={src}
              alt={`${nombre} — foto ${i + 1}`}
              fill
              priority={i === 0}
              sizes={i === 0 ? "(min-width: 640px) 50vw, 100vw" : "25vw"}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          </button>
        ))}
        <button
          onClick={() => setAbierta(0)}
          className="absolute bottom-3 right-3 rounded-full border border-borde-claro bg-noche/80 px-4 py-2 text-xs font-semibold text-tinta backdrop-blur transition hover:bg-noche"
        >
          Ver las {total} fotos
        </button>
      </div>

      <AnimatePresence>
        {abierta !== null && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Fotos de ${nombre}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/95"
          >
            <div className="flex items-center justify-between px-4 py-3 text-sm text-bruma">
              <span className="cifra">
                {abierta + 1} / {total}
              </span>
              <button
                onClick={() => setAbierta(null)}
                aria-label="Cerrar"
                className="rounded-full border border-borde px-4 py-1.5 text-xs font-semibold text-tinta transition hover:border-tiffany"
              >
                Cerrar ✕
              </button>
            </div>
            <div
              className="relative flex-1"
              onTouchStart={(e) => ((e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX))}
              onTouchEnd={(e) => {
                const x0 = Number((e.currentTarget as HTMLElement).dataset.x ?? 0);
                const dx = e.changedTouches[0].clientX - x0;
                if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
              }}
            >
              <Image
                key={fotos[abierta]}
                src={fotos[abierta]}
                alt={`${nombre} — foto ${abierta + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
              <button
                onClick={() => mover(-1)}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-noche/70 text-xl text-tinta transition hover:bg-noche"
              >
                ‹
              </button>
              <button
                onClick={() => mover(1)}
                aria-label="Foto siguiente"
                className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-noche/70 text-xl text-tinta transition hover:bg-noche"
              >
                ›
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-4 py-3">
              {fotos.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setAbierta(i)}
                  aria-label={`Ir a la foto ${i + 1}`}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition ${
                    i === abierta ? "border-tiffany" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
