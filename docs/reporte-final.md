# Reporte final — Fase 3 (2026-07-01)

## Estado de las 17 reglas
Ver `docs/cumplimiento-reglas.md` (evidencia por regla: archivo:línea o test).
**11 CUMPLEN con evidencia ejecutable · 5 PARCIALES · 2 pendientes de Fase 6.**
Ninguna implementación contradice una regla: lo pendiente es integración
bloqueada por credenciales (ver abajo), no corrección.

## Tests — 55/55 verdes (`npm test`)
| Suite | Tests | Qué prueba |
|-------|------|------------|
| `src/lib/dinero` | 13 | Centavos enteros, split 50/40/10 con suma EXACTA (15.000 combinaciones), residuo→app, caso spec $482.000 |
| `src/lib/domain/antifuga` | 19 | Teléfonos (dígitos/separados/palabras/ofuscados), correos, @usuarios, URLs; CERO falsos positivos con montos COP |
| `src/lib/domain/reserva` | 6 | Matriz COMPLETA de transiciones válidas e inválidas; sin holds; sin verde no hay entrega |
| `src/lib/fechas` | 6 | America/Bogota sin off-by-one (el bug clásico UTC, testeado); duración 1–92 noches |
| `negociacion` (unit) | 3 | Piso apagado/encendido/nunca-bajo-neta |
| `integracion` (Postgres real) | 4 | **Carrera de 2 pagos simultáneos → exactamente 1 gana**; webhook duplicado jamás duplica splits; 8 aceptaciones → 1 gana; 40 alias concurrentes únicos |
| `integracion-reglas` (Postgres real) | 4 | Link = precio aceptado exacto (impar); nadie acepta su propia oferta; piso rechaza al encenderse; **3 strikes → ban+lista negra+alias retirado+re-registro rechazado** |

CI (`.github/workflows/ci.yml`): migraciones + suite + lint + build contra
Postgres 16 de servicio en cada push.

## Lighthouse (producción, 2026-07-01)
| Ruta | Performance | Accesibilidad | Best Practices | SEO |
|------|------------|---------------|----------------|-----|
| `/` (landing) | **91** | **100** | **100** | **100** |
| `/pago/[id]` (checkout) | **96** | **95** | **100** | 63* |

\* SEO 63 del checkout es INTENCIONAL: `/pago` está excluido de indexación en
`robots.ts` — un link de pago jamás debe aparecer en buscadores.

## Verificación visual
Todas las rutas se verificaron en navegador real (Playwright) durante las fases
2 y 3: landing con flujo del dinero, calendario con arrastre, negociación con
desglose vivo, chat bloqueando "310 555 1234" contra el **servidor de
producción** (`POST /api/chat/validar` → `{"bloqueado":true,...}` verificado con
curl), checkout y estados de link. Cero errores de consola en todas.

## PWA / SEO
Manifest instalable + iconos generados + OG para WhatsApp (imagen 1200×630) +
sitemap + robots. `prefers-reduced-motion` global.

## Lo que queda — y qué lo bloquea
1. **Credenciales/gasto (Kurosh)** — `docs/PENDIENTES-KUROSH.md`: DB gestionada
   (US$10/mes, pendiente de aprobación desde Fase 2), Wompi sandbox, Truora,
   Inngest/Resend/Twilio/Sentry. Con la DB: auth real + búsqueda sobre DB
   (reglas 1 y 3 completas). Con Wompi: cobro real (reglas 9 y 11 completas).
2. **Solo código (siguen sin bloqueo, en orden):** panel /admin (Fase 5, cuelga
   del rol admin del auth), iCal + push + contratos PDF (Fase 6, cuelgan de la
   cola), OCR del chat.
3. **Humanos** — `docs/pendientes-humanos.md`: empresa, abogado (split/
   Superintendencia, contratos, T&C/Ley 1581), RNT del piloto.

## Criterio de terminado
Una persona nueva puede: clonar → `docs/demo.md` (correr local con Docker en 4
comandos) → `npm test` (55 verdes) → leer `ARQUITECTURA.md` +
`ESPECIFICACION.md` + `cumplimiento-reglas.md` y entender el negocio completo.
Build verde (23 rutas), producción desplegada: https://estadia-b2b.vercel.app

---

# Anexo — Fase 4: cierre total con adaptadores (2026-07-01)

**Directiva cumplida:** el producto completo corre HOY de punta a punta con
drivers `simulado`; encender lo real = pegar credenciales + flag
(`docs/credenciales-necesarias.md`). **75 tests verdes** (antes 55).

| Sistema nuevo | Evidencia (test que lo prueba) |
|---------------|--------------------------------|
| Auth OTP + sesiones + guards | login completo, OTP no reutilizable, rate-limit al 6º código, rol ajeno rechazado, TOTP ±1 ventana |
| Registro real + cifrado | usuario pendiente_kyc, cédula cifrada en DB, alias del servicio real |
| KYC adaptador | aprobar→activo, rechazar→kyc_rechazado, **baneado re-registrándose con otro correo → rechazado** |
| Pasarela adaptadora | webhook firma inválida→401; pago simulado procesa por el MISMO flujo (idempotencia incluida); Wompi implementado, payouts sin improvisar (decision-pasarela.md) |
| Panel /admin | 403 para no-admin y admin sin TOTP en TODA operación; reembolso con contra-splits (Σ=0, conciliación cuadra); reversión de ban con frase+motivo auditados; split 50/40/10 NO editable ni por admin |
| iCal | parser Airbnb/Booking, conflicto con reserva pagada → alerta y NO se pisa, export con token HMAC, cron 20 min |
| Contratos PDF | generado automático al Pago 1, plantilla por duración, hash sha256, **comisionistas jamás lo ven** |
| OCR chat | imagen con teléfono → bloqueada + strike; limpia → aprobada |
| **Flujo completo e2e** | registro→KYC→solicitud (primero gana)→negociación→pagos 1 y 2 por webhook→splits exactos (comisión = precio−neta al centavo)→contrato→semáforo verde→completada |

---

# Anexo — Rediseño cromático Tiffany + blanco (2026-07-01)

Cambio de piel completo sin tocar lógica: **75/75 tests siguen verdes**, cero
errores de consola, build 32 rutas.

- Tokens nuevos en `globals.css` (los nombres históricos se remapean:
  esmeralda≡confirmado, oro≡pendiente — cambiar un token cambia toda la app;
  `grep` de hexes viejos = 0 resultados).
- Física del tema claro: tarjetas blancas con sombra suave + borde 1px sobre
  fondo hueso; bandas "terciopelo" (tinta profunda) en hero y cierre de la
  landing con el flujo del dinero en Tiffany flotando encima.
- Contraste MEDIDO (docs/decision-contraste.md): botón primario = tinta sobre
  Tiffany (4.97:1 AA); blanco sobre Tiffany descartado con números (2.41:1).
  Cero texto Tiffany sobre blanco.
- Calendario: reservado=relleno Tiffany · manual=patrón rayado · iCal=claro;
  cerrojo animado en tinta. Charts retematizados (serie principal Tiffany).
- Activos: favicon/PWA/OG/theme-color regenerados en Tiffany.
- Capturas antes/después en `docs/capturas/` (landing, calendario, negociación,
  checkout, móvil 375px).
