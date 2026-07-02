# Auditoría de las 17 reglas — con evidencia (2026-07-01)

Estados: ✅ CUMPLE (con evidencia) · 🟡 PARCIAL (lógica lista, falta integración
bloqueada por credenciales) · ❌ NO CUMPLE.
Suite de referencia: `npm test` → **55/55 verdes** (unitarios + integración
contra Postgres 16).

| # | Regla | Estado | Evidencia |
|---|-------|--------|-----------|
| 1 | Solo B2B: cliente final solo `/pago/[id]` | 🟡 | La app no expone datos sin más rutas públicas que `/`, `/registro`, `/pago`; el **gate de sesión** llega con Auth (bloqueada: PENDIENTES §1). `robots.ts` ya excluye `/app` de indexación. |
| 2 | 1 noche a máx 3 meses, validado en servidor | ✅ | `src/lib/domain/reglas.ts:9` (`validarDuracion`, MAX=92) · tests en `src/lib/fechas.test.ts` (acepta 92, rechaza 93/invertidas) |
| 3 | Sin suscripción activa → propiedades invisibles | 🟡 | Modelado (`suscripciones.estado`, `propiedades.publicada`); el filtro de búsqueda server llega con la búsqueda real sobre DB. Seed crea suscripciones activas. |
| 4 | 3–5 principales, validado en servidor | ✅ (dominio) | `src/lib/domain/reglas.ts:33` (`puedeVincular/puedeDesvincular`) · UI bloquea desvincular bajo mínimo (`principales/page.tsx`) · constraint único en DB |
| 5 | Tarifa neta intocable; neta − 3% exacto | ✅ | `src/lib/dinero/index.ts` (`liquidarReserva` lanza si precio < neta; `propietarioNeto`) · `dinero.test.ts` caso spec $482.000 exacto |
| 6 | Link SOLO del precio aceptado por ambos | ✅ | `src/server/servicios/negociacion.ts` (`aceptarOfertaYGenerarLink`: monto sale de la oferta en DB, jamás de un parámetro) · test integración: link = floor(precio/2) con precio impar; nadie acepta su propia oferta |
| 7 | Split 50/40/10 exacto en centavos; residuo → app | ✅ | `repartirComision` (floor+floor+residuo) · test "el residuo va a la plataforma" (101 → 50/40/11) + 10.000 montos con suma exacta |
| 8 | Piso: existe, APAGADO, y al encenderlo rechaza | ✅ | Config en DB (`configuracion_plataforma.piso_comision`) · test integración: se enciende, oferta bajo el piso rechazada, se apaga de nuevo |
| 9 | Pago 50/50 por link; sin flujo alternativo | ✅ (código) | Único camino: `aceptarOfertaYGenerarLink` → `linksDePago` → `procesarWebhookPago`. No existe endpoint de cobro manual. Cobro real pendiente de Wompi (🟡 operativo). |
| 10 | Sin holds; carrera de pagos: uno gana, otro INVALIDADO sin cobro | ✅ | `pagos.ts` (lock FOR UPDATE de días) · `integracion.test.ts` carrera simultánea: 1 procesado, perdedor invalidado y sin splits · `reserva.test.ts`: `calendarioBloqueado(LINK_1_ENVIADO)=false` |
| 11 | Cada mitad se dispersa al confirmarse; conciliación al centavo | ✅ (registro) / 🟡 (payout real) | Splits exactos por transacción con `verificarCuadre` que DETIENE si no cuadra · dispersión bancaria real requiere Wompi payouts |
| 12 | 3% solo propietario; calculadora desde que fija tarifa | ✅ | `calcularNetoPropietario` + pantalla calendario/tarifa con desglose en vivo · verificado en navegador |
| 13 | "Pago completo ✓" solo con ambos webhooks | ✅ (lógica) | `transicionPostPago` (mitad 2 → PAGO_COMPLETO) · `entregaAutorizada` testeada · semáforo en vivo en UI |
| 14 | Solo propietario escribe calendario; ocupados inseleccionables | ✅ (UI+modelo) | Ficha: `disabled` en ocupados (`ficha-propiedad.tsx`) · calendario propietario: reservado_app/ical no editables · escritura server llega con auth (quién es propietario) |
| 15 | iCal import/export con última sync visible | ❌ | UI muestra estado (demo); job real = Fase 6 (requiere Inngest) |
| 16 | Anti-fuga EN SERVIDOR + OCR + 3 strikes → ban por identidad + re-registro rechazado | ✅ (texto, e2e) / ❌ (OCR) | `/api/chat/validar` (probado en prod) · `procesarMensaje` test e2e: 3 strikes → baneado + lista negra + alias retirado + `identidadBaneada()=true` · variantes ofuscadas testeadas (19 tests, sin falsos positivos COP) · OCR pendiente (cola) |
| 17 | Alias server-side, único, irrepetible; cero fugas de datos personales | ✅ | `asignarAliasUnico` (PK en DB, 40 concurrentes únicos, retiro permanente testeado) · única API existente (`/api/chat/validar`) no devuelve datos de usuarios; schema separa `nombre_real/cedula` (cifrados) de todo lo visible |

## Resumen

- **11 reglas CUMPLEN con evidencia ejecutable hoy** (2, 4, 5, 6, 7, 8, 10, 12, 13, 16-texto, 17).
- **5 PARCIALES** (1, 3, 9, 11, 14): la lógica y el modelo existen y están
  testeados; el tramo faltante es exactamente el bloqueado por credenciales
  (auth real, Wompi payouts, búsqueda sobre DB).
- **2 NO CUMPLEN aún** (15 iCal real, 16-OCR): Fase 6, dependen de la cola.

Ninguna regla tiene una implementación que la CONTRADIGA: lo pendiente es
integración, no corrección.
