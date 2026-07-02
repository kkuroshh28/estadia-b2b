"use client";

import { useEffect, useRef, useState } from "react";
import {
  MotionConfig,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { formatearCOP } from "@/lib/domain/split";

/** Config global: respeta prefers-reduced-motion en toda la app. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Revelado al entrar en viewport — una orquestación, no efectos dispersos. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Cifra de dinero animada: cuenta hacia arriba al entrar en viewport y
 * transiciona con spring cuando el valor cambia (desglose en vivo).
 */
export function MoneyAnimado({
  valor,
  className = "",
}: {
  valor: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const enVista = useInView(ref, { once: true, margin: "-40px" });
  const reducido = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const [texto, setTexto] = useState(() => formatearCOP(0));

  useEffect(() => {
    if (enVista) mv.set(valor);
  }, [enVista, valor, mv]);

  useEffect(
    () => spring.on("change", (v) => setTexto(formatearCOP(Math.round(v)))),
    [spring],
  );

  return (
    <span ref={ref} className={`cifra ${className}`}>
      {reducido ? formatearCOP(valor) : texto}
    </span>
  );
}

/** Entrada escalonada para listas (solicitudes, ofertas, splits). */
export function Entrada({
  children,
  index = 0,
  className = "",
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 260, damping: 26 }}
    >
      {children}
    </motion.div>
  );
}
