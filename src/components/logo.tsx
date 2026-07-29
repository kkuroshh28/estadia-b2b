/**
 * Logo THE CIRCLE — anillo "C" en latón dorado con THE/IRCLE a la derecha,
 * con brillo de latón en movimiento (texto por background-clip; anillo por
 * gradiente SVG animado). prefers-reduced-motion lo congela en dorado plano.
 */
export function LogoCircle({
  className = "",
  tam = 30,
}: {
  className?: string;
  /** Alto aproximado del logo en px (el anillo escala proporcional). */
  tam?: number;
}) {
  const anillo = tam * 1.6;
  const gid = `oro-${tam}`;
  return (
    <span
      className={`inline-flex select-none items-center text-tiffany ${className}`}
      aria-label="THE CIRCLE"
    >
      <svg
        width={anillo}
        height={anillo}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{ marginRight: -anillo * 0.08 }}
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
        <path
          d="M 19.2 5.4 A 9.4 9.4 0 1 0 19.2 18.6"
          stroke={`url(#${gid})`}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="flex flex-col" style={{ lineHeight: 1 }}>
        <span
          className="font-display oro-brillante"
          style={{
            fontSize: tam * 0.3,
            letterSpacing: "0.5em",
            marginBottom: tam * 0.16,
            marginLeft: tam * 0.58,
          }}
        >
          THE
        </span>
        <span
          className="font-display oro-brillante"
          style={{ fontSize: tam * 0.68, letterSpacing: "0.34em", fontWeight: 480 }}
        >
          IRCLE
        </span>
      </span>
    </span>
  );
}
