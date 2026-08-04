/**
 * Logo THE CIRCLE — fiel a la marca: la "C" es una LUNA CRECIENTE dorada
 * (gruesa a la izquierda, puntas afiladas hacia la derecha) y THE/IRCLE
 * viven dentro de su boca. Brillo de latón en movimiento (texto por
 * background-clip; creciente por gradiente SVG). reduced-motion → dorado plano.
 */
export function LogoCircle({
  className = "",
  tam = 30,
}: {
  className?: string;
  /** Alto aproximado del texto IRCLE en px (todo escala proporcional). */
  tam?: number;
}) {
  const anillo = tam * 2.4;
  const gid = `oro-${tam}`;
  return (
    <span
      className={`inline-flex select-none items-center text-tiffany ${className}`}
      aria-label="THE CIRCLE"
    >
      <svg
        width={anillo}
        height={anillo}
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
        style={{ marginRight: -anillo * 0.66 }}
      >
        <defs>
          <linearGradient id={gid} x1="-1" y1="0" x2="0" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#c9a46b" />
            <stop offset="0.45" stopColor="#f4e3b8" />
            <stop offset="0.5" stopColor="#fff6dd" />
            <stop offset="0.55" stopColor="#f4e3b8" />
            <stop offset="1" stopColor="#c9a46b" />
            <animate attributeName="x1" values="-2;1" dur="4.5s" repeatCount="indefinite" />
            <animate attributeName="x2" values="0;3" dur="4.5s" repeatCount="indefinite" />
          </linearGradient>
        </defs>
        {/* Creciente: arco exterior r40 + arco interior r37.6 por las mismas
            puntas (72.9, 17.2/82.8) — grosor ~7 al lado izquierdo, puntas 0. */}
        <path
          d="M 72.9 17.2
             A 40 40 0 1 0 72.9 82.8
             A 37.6 37.6 0 1 1 72.9 17.2
             Z"
          fill={`url(#${gid})`}
        />
      </svg>
      <span className="flex flex-col" style={{ lineHeight: 1 }}>
        <span
          className="font-display oro-brillante"
          style={{
            fontSize: tam * 0.3,
            letterSpacing: "0.5em",
            marginBottom: tam * 0.18,
            marginLeft: tam * 0.06,
            fontWeight: 600,
          }}
        >
          THE
        </span>
        <span
          className="font-display oro-brillante"
          style={{ fontSize: tam * 0.66, letterSpacing: "0.36em", fontWeight: 640 }}
        >
          IRCLE
        </span>
      </span>
    </span>
  );
}
