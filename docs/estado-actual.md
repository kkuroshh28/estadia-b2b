# Estado real del proyecto — inventario honesto (2026-07-20)

## Novedades 2026-07-20 (sesión de mejoras sin credenciales)
- **Dashboards /app conectados a datos por sesión** (`src/server/datos/`):
  con DATABASE_URL las 11 vistas leen Postgres real scoped al usuario (o al
  usuario semilla en dev); sin DB, la demo pública intacta. Con MODO_AUTH un
  error de DB jamás degrada a datos falsos. Verificado en navegador con seed.
- **Calendario con escritura REAL**: `bloquearDias/liberarDias` + endpoint
  `/api/calendario` — la regla #14 vive en el WHERE (jamás toca reservado_app
  ni bloqueado_ical). 5 tests de integración; clic verificado persistiendo.
- **FIX motor de pagos**: split `tarifa_neta` ahora lleva `beneficiario_id`
  del propietario (antes NULL; la dispersión no sabría a quién pagar).
- **FIX pool de conexiones**: `obtenerDb()` cachea el pool en globalThis.
- **OCR real**: tesseract.js 7 instalado y verificado (activar =
  `OCR_DRIVER=tesseract`); anti-fuga probado contra texto degradado por OCR.
- **Driver MercadoPago** (plan B): preferences + webhook x-signature
  verificado + reembolsos idempotentes; `dispersar()` lanza hasta validar
  payouts en sandbox (igual que Wompi — regla de no improvisar con dinero).
- **Seguridad HTTP**: CSP sin orígenes externos, HSTS preload, X-Frame-Options
  DENY, nosniff, Permissions-Policy + rate limiting por IP en registro (5/min),
  chat (30/min) y calendario (60/min).
- **Performance**: LCP del hero pinta desde el primer byte (RevealHero solo
  anima traslación). Lighthouse local: 94 / 100 / 100 / 100.
- Suite: **89 tests** (todos verdes contra Postgres 16 real).

## Novedades 2026-07-20 (2ª sesión): CICLO OPERATIVO COMPLETO REAL
- **La app ya opera de punta a punta con el motor real** (verificado clic a
  clic en navegador contra Postgres): el externo solicita fechas desde la
  ficha (`POST /api/solicitudes`), el principal acepta ("el primero gana",
  UPDATE condicional; crea reserva EST-YYYY-NNNNN + negociación vía
  `servicios/solicitudes.ts`), ambos negocian con ofertas REALES por turnos
  (`/api/negociacion/ofertar`), la aceptación genera el link del MOTOR
  (regla #6) y transiciona la reserva; el checkout `/pago/[linkId]` lee el
  link real y paga por `/api/pagos/simular` → mismo webhook firmado →
  splits exactos + contrato + semáforo. Todo visible en paneles y comisiones.
- **FIX de integridad crítico**: el webhook ahora MATERIALIZA las filas de
  calendario del rango antes del lock (`generate_series` + ON CONFLICT DO
  NOTHING). Antes, un pago sobre fechas sin filas no bloqueaba el calendario
  → una segunda venta podía colarse. Con test.
- Reglas nuevas en servidor: solo principales VINCULADOS aceptan; suscripción
  activa del propietario obligatoria (regla #3); turnos de oferta; capacidad.
- Suite: **91 tests** verdes.

## Novedades 2026-07-20 (3ª sesión): saldo, chat y registro REALES
- **Link del saldo (mitad 2)**: `generarLinkSaldo` idempotente (solo
  participantes, reserva ANTICIPO_PAGADO, monto del motor, vence ≤ check-in)
  + `/api/reservas/saldo` + tarjeta "Generar link del saldo" en Links del
  externo. Verificado en navegador: EST-2026-00401 pagó su saldo por el
  checkout → **PAGO_COMPLETO → semáforo VERDE → "Entrega autorizada"**.
- **Chat REAL persistente**: `/api/chat/mensajes` pasa TODO mensaje por
  `procesarMensaje` (anti-fuga server-side) — un bloqueado se persiste como
  evidencia (flags con motivos), suma strike real y al 3º banea la identidad;
  jamás se entrega a la otra parte (solo su emisor lo ve tachado). Hilo por
  solicitud (misma conversación del módulo de negociación).
- **Registro REAL**: el wizard crea el usuario por `/api/registro` (cédula
  CIFRADA, alias único de la DB) y `/api/kyc/simular` lo aprueba por el MISMO
  callback firmado del proveedor (lista negra incluida). La revelación del
  alias muestra el REAL. Verificado: usuaria activa con alias ROBLE-472.
- Suite: **91 tests** verdes; build limpio.


Regla: nada se marca hecho sin evidencia (test, archivo:línea o demostración
reproducible). Suite de referencia: `npm test` → **80 tests verdes** (unitarios +
integración contra Postgres 16 real, local y en CI).

## Directiva Fase 4 cumplida
El producto completo funciona de punta a punta HOY con drivers `simulado`, y
pasar a servicios reales es **exclusivamente pegar credenciales en .env**
siguiendo `docs/credenciales-necesarias.md` — cero código adicional.

## Sistemas — estado real

| Sistema | Estado | Evidencia |
|---------|--------|-----------|
| Dinero (centavos, split exacto) | ✅ REAL | `src/lib/dinero` · 13 tests |
| DB (schema 28 tablas + 2 migraciones) | ✅ REAL | corre contra Postgres 16 (Docker/CI) |
| Máquina de estados server-only + auditoría | ✅ REAL | matriz completa testeada |
| **Auth: OTP email + sesiones httpOnly + guards por rol** | ✅ REAL | `src/server/auth` · 10 tests (login, rate-limit, rol ajeno rechazado, TOTP) |
| **Registro real → pendiente_kyc + alias + cifrado en reposo** | ✅ REAL | `servicios/registro.ts` · test verifica cédula cifrada |
| **KYC adaptador** | ✅ sim completo · truora listo para llave | `adaptadores/kyc.ts` · tests aprobar/rechazar/lista-negra; re-registro de baneado rechazado e2e |
| **Pasarela adaptador** | ✅ sim completo (mismo webhook firmado) · wompi listo para llaves | `adaptadores/pasarela.ts` · webhook 401 con firma mala; pago sim procesa por el flujo REAL. Payouts Wompi: sin improvisar (`docs/decision-pasarela.md`) |
| **Panel /admin (6 consolas + 2FA TOTP)** | ✅ REAL | verificaciones, anti-fuga (ban/reversión doble confirmación), dinero+conciliación, métricas, config auditada, bandeja dev · 5 tests (403 no-admin, contra-splits, split no editable) |
| **iCal import/export real** | ✅ REAL | parser Airbnb/Booking testeado, conflicto→alerta admin, export con token HMAC, cron cada 20 min (`vercel.json`) |
| **Notificaciones por evento** | ✅ sim (bandeja /admin/dev) · resend listo | pago confirmado notifica a las 3 partes (test) |
| **Contratos PDF automáticos** | ✅ REAL | pdf-lib + plantillas editables (borrador para abogado); tipo por duración; hash sha256; **comisionistas jamás los ven** (test) |
| **OCR anti-fuga en chat** | ✅ sim · tesseract por flag | imagen "en_revision" → filtro → strikes (test) |
| **Flujo completo e2e** | ✅ | `operacion.test.ts`: registro→KYC→solicitud→negociación→pagos 1 y 2 por webhook→splits exactos→contrato→semáforo verde→completada |
| CI (Postgres servicio + suite + lint + build) | ✅ | `.github/workflows/ci.yml` |
| Seed demo | ✅ | `npm run db:seed` idempotente |

## Lo único pendiente
1. **Pegar credenciales reales** (`docs/credenciales-necesarias.md`): DATABASE_URL
   gestionada, Wompi, Truora, Resend + flags. Con `MODO_AUTH=exigida` los guards
   se encienden en el mismo deploy.
2. **Validar payouts Wompi en sandbox** (decisión documentada; MercadoPago como
   plan B con la misma interfaz).
3. **Pendientes humanos legales** (`docs/pendientes-humanos.md`): empresa,
   abogado (contratos/T&C/split), RNT del piloto.
4. Conectar dashboards de la demo a datos por sesión (hoy la demo pública usa
   datos simulados coherentes; los servicios ya son reales por debajo).
