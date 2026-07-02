# Estado real del proyecto — inventario honesto (Fase 3, 2026-07-01)

Regla de este documento: **nada se marca hecho sin evidencia** (test, archivo:línea
o demostración reproducible). "Demo" = funciona con datos simulados coherentes;
"Real" = contra base de datos/servicio de verdad.

## Pantallas (16 rutas — todas construidas y verificadas en navegador)

| Ruta | Estado | Nota |
|------|--------|------|
| `/` landing | **Completa** | OG/SEO/PWA listos; flujo del dinero animado |
| `/registro` onboarding | **Completa (demo)** | KYC simulado; revelación de alias real (`generarAlias`) |
| `/app` hub | Completa | Solo demo: en prod cada usuario ve su rol |
| `/app/propietario` (+ calendario, principales) | **Completa (demo)** | Calculadora de neto usa el modelo real |
| `/app/principal` (+ negociación, comisiones) | **Completa (demo)** | Desglose en vivo usa `calcularSplit` real |
| `/app/externo` (+ links, comisiones, propiedad/[id]) | **Completa (demo)** | Días ocupados inseleccionables |
| `/app/chat` | **Completa** | Filtro anti-fuga **REAL en servidor** (`/api/chat/validar`) |
| `/pago/[linkId]` | **Completa (demo)** | Pago simulado; motor real listo detrás de `PasarelaAdapter` |
| 404 / 500 | Completa | Con el sistema de diseño |

## Sistemas de backend — estado REAL

| Sistema | Estado | Evidencia |
|---------|--------|-----------|
| Módulo de dinero (centavos, split exacto) | ✅ **REAL + testeado** | `src/lib/dinero` · 13 tests (15.000 combinaciones de invariantes) |
| Base de datos (schema 22 tablas + migraciones) | ✅ **REAL** (falta provisionar la instancia gestionada) | `src/server/db/schema.ts`, `drizzle/0000_*.sql`; suite corre contra Postgres 16 (Docker/CI) |
| Máquina de estados (server-only + auditoría) | ✅ **REAL + testeado** | `src/server/servicios/reservas.ts` · matriz completa testeada |
| "El primero que paga gana" (concurrencia) | ✅ **REAL + testeado** | `integracion.test.ts`: carrera de 2 webhooks → 1 gana |
| Webhooks idempotentes + splits | ✅ **REAL + testeado** | `pagos.ts`: duplicado → jamás duplica splits (test) |
| Anti-fuga en servidor + strikes + ban a identidad | ✅ **REAL + testeado** | `antifuga.ts` + `integracion-reglas.test.ts` (3 strikes e2e) |
| Alias único/irrepetible en servidor | ✅ **REAL + testeado** | 40 concurrentes únicos; colisión con retry probada |
| Negociación server: link SOLO del precio aceptado | ✅ **REAL + testeado** | `negociacion.ts` + test regla #6 |
| Piso de comisión (switch en config) | ✅ **REAL + testeado** | Apagado por defecto; test lo enciende y verifica rechazo |
| Auth (Auth.js + OTP + passkeys) | ❌ **NO construida** | Bloqueada por decisión DB + secretos (PENDIENTES-KUROSH §1,6) |
| KYC Truora | ❌ **NO integrada** | Gate `identidadBaneada()` listo; falta `TRUORA_API_KEY` |
| Pasarela Wompi (links/webhook/dispersión reales) | ❌ **Sandbox NO conectado** | Motor completo detrás de `PasarelaAdapter`; faltan llaves |
| Panel /admin | ❌ **NO construido** | Fase 5 del plan |
| iCal real / push / contratos PDF | ❌ **NO construidos** | Fase 6 del plan |
| OCR de imágenes en chat | ❌ **NO construido** | Requiere cola (Inngest) activa |
| CI (tests + lint + build con Postgres de servicio) | ✅ Configurado | `.github/workflows/ci.yml` (corre en el próximo push) |
| Seed realista | ✅ **REAL + verificado** | `npm run db:seed`: 12 propiedades, 8 alias, reserva pagada VÍA MOTOR REAL, idempotente |

## Por qué los ❌ siguen así (no es código pendiente de escribir)

Los cuatro sistemas ❌ de integración dependen de **cuentas/credenciales/dinero
que solo Kurosh puede aportar** (`docs/PENDIENTES-KUROSH.md`): DB gestionada
(US$10/mes en su org Supabase — gasto recurrente que no se aprueba solo), llaves
Wompi sandbox, cuenta Truora, Inngest/Resend/Twilio/Sentry. El panel admin
(Fase 5) sí es solo código y es lo primero que sigue cuando haya auth real de
la cual colgar el rol admin + 2FA.
