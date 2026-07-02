/**
 * Filtro anti-fuga (§7.3) — bloqueo PRE-envío. En producción corre EN EL
 * SERVIDOR (src/server/servicios/antifuga.ts); el cliente lo usa solo como UX.
 * Detecta teléfonos (dígitos, separados, y escritos en palabras es-CO),
 * correos, @usuarios, URLs de contacto y variantes ofuscadas ("3-1-0",
 * "tres10", "wsp"). Los montos en COP ($5.100.000) NO son falsos positivos.
 */

export interface ResultadoFiltro {
  bloqueado: boolean;
  motivos: string[];
}

const PALABRA_A_DIGITO: Record<string, string> = {
  cero: "0", uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4",
  cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9", diez: "10",
};

/** Quita montos de dinero (formato es-CO) para no marcar precios como teléfonos. */
function quitarDinero(texto: string): string {
  return texto
    .replace(/\$\s?[\d.,]+/g, " ")
    .replace(/\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/g, " "); // 5.100.000 estilo miles
}

/** Convierte palabras-número a dígitos y colapsa separadores entre dígitos. */
function normalizarNumeros(texto: string): string {
  let t = texto.toLowerCase();
  t = t.replace(
    /\b(cero|un[oa]|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/g,
    (m) => PALABRA_A_DIGITO[m] ?? m,
  );
  // "3-1-0", "3 1 0", "3.1.0", "tres10" → dígitos contiguos
  t = t.replace(/(\d)[\s.\-_/·]{1,3}(?=\d)/g, "$1");
  return t;
}

const PATRONES: { patron: RegExp; motivo: string }[] = [
  { patron: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, motivo: "Correo electrónico" },
  {
    patron: /\b(?:whats?app|wpp|wsp|guasap|telegram|insta(?:gram)?|face(?:book)?|tik\s?tok|señal|signal)\b/i,
    motivo: "Mención de canal externo",
  },
  { patron: /@[a-z0-9_.]{3,}/i, motivo: "Usuario de red social" },
  { patron: /(?:wa\.me|t\.me|ig\.me|linktr\.ee|bit\.ly)\/\S+/i, motivo: "URL de contacto" },
  {
    patron: /\b(?:ll[aá]mame|escr[ií]beme|mi\s+n[uú]mero|te\s+paso\s+el\s+(?:dato|n[uú]mero)|marcame|m[aá]rcame)\b/i,
    motivo: "Solicitud de contacto por fuera",
  },
];

export function filtrarMensaje(texto: string): ResultadoFiltro {
  const motivos = new Set<string>();

  for (const { patron, motivo } of PATRONES) {
    if (patron.test(texto)) motivos.add(motivo);
  }

  // Detección numérica sobre texto SIN montos de dinero y NORMALIZADO
  const normalizado = normalizarNumeros(quitarDinero(texto));
  if (/(?:\+?57)?3\d{9}(?!\d)/.test(normalizado)) {
    motivos.add("Número de celular colombiano");
  }
  if (/\d{7,10}/.test(normalizado)) {
    motivos.add("Secuencia numérica tipo teléfono");
  }

  return { bloqueado: motivos.size > 0, motivos: [...motivos] };
}
