# Qué necesito de Kurosh para desbloquear cada fase

El código de dominio, schema, motor de pagos (con adapter) y tests ya están en el
repo. Estas credenciales/cuentas son lo ÚNICO que falta para encender cada pieza.
Todas van en `.env.local` (dev) y en Vercel → Settings → Environment Variables
(staging = Preview, producción = Production). Jamás en el repo.

## 1. Base de datos (desbloquea Fase 1-2 completa + tests de concurrencia)
- Crear DOS proyectos Postgres nuevos y PROPIOS de ESTADÍA (Supabase u otro):
  `estadia-staging` y `estadia-prod` (dev puede usar staging o un tercero).
  ⚠️ NUNCA reutilizar los proyectos de BHIA o ContaAI.
- Pasarme: `DATABASE_URL` de cada uno (con el pooler en modo transaction).
- Yo aplico las migraciones (`npx drizzle-kit migrate`) y corro la suite de
  concurrencia (carrera de pagos, aceptaciones, alias) contra staging.

## 2. Wompi sandbox (desbloquea Fase 3 — motor de pagos real)
- Crear cuenta de comercio en Wompi y activar el ambiente SANDBOX.
- Pasarme: `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`.
- Punto CRÍTICO a validar con ellos (yo preparo el POC): dispersión/split a
  terceros (payouts a cuentas de comisionistas y propietarios). Si Wompi no lo
  cubre como lo exige el modelo, hago el POC comparativo con MercadoPago
  Marketplace ANTES de escribir un peso — no improviso con el dinero.

## 3. Truora sandbox (desbloquea KYC + ban por identidad end-to-end)
- Cuenta en Truora con acceso sandbox → `TRUORA_API_KEY`.
- Alternativa equivalente: MetaMap.

## 4. Notificaciones (Fase 6)
- `RESEND_API_KEY` (email transaccional; verificar dominio de envío).
- Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) para OTP por SMS.
- Firebase/FCM para push (o OneSignal): archivo de credenciales del proyecto.

## 5. Colas y observabilidad (Fases 3-4-7)
- Cuenta Inngest (gratuita para empezar): `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
- Cuenta Sentry: `SENTRY_DSN`.

## 6. Secretos que YO genero (solo confirmar dónde guardarlos)
- `ENCRYPTION_KEY` (cifrado de cédulas/cuentas en reposo) y `AUTH_SECRET`:
  los genero con `openssl rand -hex 32` y los cargo en Vercel; necesito que
  guardes copia en tu gestor de contraseñas.

## Orden recomendado
1 (DB) → puedo terminar Fase 1-2 y demostrar la concurrencia el mismo día.
2 (Wompi) → enciendo el checkout real en staging.
3 (Truora) → KYC + prueba end-to-end del ban perpetuo.
4-5 → operación completa.
