# Guía para el fundador — encender los servicios reales pegando credenciales

**Regla de seguridad absoluta: las llaves JAMÁS se pegan en chats ni se suben al
repo.** Solo van en dos lugares: el archivo `.env.local` de tu computador (que
git ignora) y en Vercel → tu proyecto → Settings → Environment Variables.

**Cómo funciona:** todo servicio externo corre hoy en modo `simulado` (completo,
para desarrollo y demo). Al pegar la credencial y cambiar el FLAG indicado, el
driver real se enciende **sin tocar una línea de código**.

## 1. Base de datos (lo primero — desbloquea todo lo demás)
- **Qué:** un proyecto PostgreSQL propio de ESTADÍA por entorno (staging y producción).
- **Dónde:** https://supabase.com (crear cuenta NUEVA para ESTADÍA si no quieres
  el cobro de US$10/mes en tu org actual) o https://neon.tech (plan gratuito).
- **Qué copiar:** la "Connection string" (URI) en modo *Transaction pooler*.
- **Dónde pegarla:** `DATABASE_URL`
- **Después:** me avisas y yo corro `npm run db:migrate` + `npm run db:seed`.
- **Flag adicional:** `MODO_AUTH=exigida` (activa login y guards de rol).

## 2. Pasarela de pagos — Wompi (sandbox primero)
- **Qué:** cuenta de comercio en https://comercios.wompi.co → ambiente Sandbox.
- **Qué copiar:** llave pública, llave privada y "Events secret" (webhooks).
- **Dónde pegarlas:** `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`.
- **Flag:** `PASARELA_DRIVER=wompi` y `WOMPI_ENV=sandbox`.
- ⚠️ Antes de producción hay que confirmar con Wompi su producto de dispersión
  a terceros — ver `docs/decision-pasarela.md`. El código NO improvisa: si no
  está habilitado, la dispersión falla en voz alta.

## 3. KYC — Truora (sandbox)
- **Qué:** cuenta en https://www.truora.com → producto Identity → API key de sandbox.
- **Dónde pegarla:** `TRUORA_API_KEY`.
- **Flag:** `KYC_DRIVER=truora`.

## 4. Email — Resend
- **Qué:** cuenta gratuita en https://resend.com → API key. Verificar tu dominio
  de envío (te da 2 registros DNS para agregar).
- **Dónde pegarla:** `RESEND_API_KEY` (+ `EMAIL_REMITENTE=ESTADÍA <hola@tudominio.com>`).
- **Flag:** `EMAIL_DRIVER=resend`. Mientras tanto los correos se ven en `/admin/dev`.

## 5. Push — OneSignal (cuando toque)
- **Qué:** cuenta gratuita en https://onesignal.com → App ID + REST API key.
- **Dónde:** `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` (driver pendiente de conectar
  al mismo despachador de notificaciones — hoy salen por email).

## 6. Secretos internos (los genero yo, tú los guardas)
Se generan con `openssl rand -hex 32` y van en Vercel y en tu gestor de
contraseñas: `ENCRYPTION_KEY`, `HASH_PEPPER`, `AUTH_SECRET`, `WEBHOOK_SECRET`,
`KYC_CALLBACK_SECRET`, `ICAL_SECRET`, `CRON_SECRET`.

## Tabla resumen de flags

| Servicio | Flag | Hoy (sin credenciales) | Con credenciales |
|----------|------|------------------------|------------------|
| Auth/guards | `MODO_AUTH` | (vacío) demo pública | `exigida` |
| Pagos | `PASARELA_DRIVER` | `simulado` | `wompi` |
| KYC | `KYC_DRIVER` | `simulado` | `truora` |
| Email | `EMAIL_DRIVER` | `simulado` (bandeja /admin/dev) | `resend` |
| OCR chat | `OCR_DRIVER` | `simulado` | `tesseract` |
