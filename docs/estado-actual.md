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
