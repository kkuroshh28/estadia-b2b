# Rediseño Tiffany + blanco — decisión de contraste (medida, no a ojo)

Ratios WCAG calculados por script (2026-07-01). AA texto normal ≥ 4.5:1.

## La decisión de los botones primarios (regla 2 del brief)

| Opción evaluada | Ratio | Veredicto |
|-----------------|-------|-----------|
| Blanco sobre `--tiffany` #0ABAB5 | **2.41:1** | ✗ Reprueba — descartada |
| Blanco sobre `--tiffany-profundo` #089E9A | **3.30:1** | Solo texto grande — descartada para botones estándar |
| **`--tinta` #0F3D3B sobre `--tiffany` #0ABAB5** | **4.97:1** | ✓ AA — **ELEGIDA** |
| `--tinta` sobre `--tiffany-claro` #81D8D0 (hover) | **7.23:1** | ✓ AA — hover elegido |

**Botón primario = fondo Tiffany + texto tinta bold · hover = fondo tiffany-claro.**

## Todos los pares del sistema (en uso)

| Par | Ratio | |
|-----|-------|--|
| tinta / blanco · tinta / hueso | 11.99 · 11.43 | ✓ |
| tinta / tiffany-bruma | 10.99 | ✓ |
| bruma / blanco · bruma-osc / blanco | 4.97 · 4.74 | ✓ |
| blanco / tinta (bandas terciopelo) | 11.99 | ✓ |
| tiffany-claro / tinta (acentos del hero) | 7.23 | ✓ |
| #B9CFCD / tinta (subtítulos del hero) | 7.35 | ✓ |
| confirmado / blanco · / tenue | 5.48 · 5.21 | ✓ |
| pendiente / blanco · / tenue | 5.02 · 4.84 | ✓ |
| error / blanco · / tenue | 6.47 · 5.91 | ✓ |
| azul / blanco (iCal info) | 5.43 | ✓ |
| **tiffany / blanco (texto)** | **2.41** | **PROHIBIDO — regla 1, respetada: cero usos** |

## Semántica conservada
`esmeralda`→confirmado #047857, `oro`/`ambar`→pendiente #B45309, `rojo`→error
#B91C1C: los nombres históricos de tokens se remapearon para que TODO el
lenguaje del dinero conservara su significado sin tocar la lógica. El Tiffany
es exclusivamente marca/acción; jamás significa "dinero confirmado".


---

## Ajuste: el color EXACTO de Tiffany & Co. (a pedido del fundador, con referencia visual)

**Análisis:** el color de marca de Tiffany & Co. es un Pantone privado y marca
registrada, **PMS 1837** (año de fundación). Pantone no publica su fórmula; las
dos aproximaciones que circulan son **#81D8D0** (el *robin's egg blue* de la
caja/empaques — la aproximación citada para PMS 1837 y la que coincide con la
referencia visual del logo enviada) y #0ABAB5 (variante digital más profunda).

**Decisión:** `--tiffany = #81D8D0` (primario, bandas de marca y botones) ·
`--tiffany-profundo = #0ABAB5` (acentos/hover profundos) · `--tiffany-claro =
#B7EBE6`. La banda del hero pasó de tinta oscura al Tiffany auténtico.

| Par nuevo | Ratio | |
|-----------|-------|--|
| tinta / #81D8D0 (banda + botones) | **7.23** | ✓ AA (mejor que el 4.97 anterior) |
| blanco / tinta (CTA oscuro sobre banda — como el logo de Tiffany) | 11.99 | ✓ |
| tinta / #B7EBE6 (hover) | 9.16 | ✓ |
| tinta / #0ABAB5 (profundo) | 4.97 | ✓ |
