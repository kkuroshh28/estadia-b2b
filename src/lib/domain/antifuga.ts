/**
 * Filtro anti-fuga (§7.3) — bloqueo PRE-envío en el chat interno.
 * Detecta intentos de intercambio de datos de contacto. En producción se
 * complementa con NLP y OCR sobre imágenes; esto es la primera línea determinista.
 * Consecuencia de negocio: ban perpetuo a la identidad (cédula + biometría).
 */

export interface ResultadoFiltro {
  bloqueado: boolean;
  motivos: string[];
}

const NUMEROS_EN_PALABRAS =
  "(?:cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)";

const PATRONES: { patron: RegExp; motivo: string }[] = [
  { patron: /(?:\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/, motivo: "Número de celular colombiano" },
  { patron: /\d{7,10}/, motivo: "Secuencia numérica tipo teléfono" },
  {
    patron: new RegExp(`${NUMEROS_EN_PALABRAS}(?:[\\s,y]+${NUMEROS_EN_PALABRAS}){5,}`, "i"),
    motivo: "Número telefónico escrito en palabras",
  },
  { patron: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, motivo: "Correo electrónico" },
  { patron: /\b(?:whats?app|wpp|guasap|telegram|insta(?:gram)?|face(?:book)?|tik\s?tok)\b/i, motivo: "Mención de canal externo" },
  { patron: /@[a-z0-9_.]{3,}/i, motivo: "Usuario de red social" },
  { patron: /(?:wa\.me|t\.me|ig\.me|linktr\.ee|bit\.ly)\/\S+/i, motivo: "URL de contacto" },
  { patron: /\b(?:ll[aá]mame|escr[ií]beme|mi\s+n[uú]mero|te\s+paso\s+el\s+(?:dato|n[uú]mero))\b/i, motivo: "Solicitud de contacto por fuera" },
];

export function filtrarMensaje(texto: string): ResultadoFiltro {
  const motivos = PATRONES.filter(({ patron }) => patron.test(texto)).map(
    ({ motivo }) => motivo,
  );
  return { bloqueado: motivos.length > 0, motivos };
}
