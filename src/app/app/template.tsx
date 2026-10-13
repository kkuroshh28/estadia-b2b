"use client";

import { m } from "motion/react";

/**
 * Transición de ruta dentro de la app: slide sutil, 240 ms.
 * Sin opacity en el estado inicial: el HTML servido es visible desde el primer
 * paint (no espera a que hidrate el JS para mostrarse).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
