# ESTADÍA — Arquitectura de producción (Paso 0, Fase 2)

**Regla suprema de esta fase: la corrección financiera está por encima de todo.**
Cada peso que entra debe poder rastrearse hasta el peso que sale.

## 1. Diagrama de servicios

```
                                   ┌──────────────────────────────┐
   Cliente final (checkout web)    │  VERCEL — Next.js (este repo)│
   Comisionistas / Propietarios ──▶│  · UI (App Router)           │
   Admin (/admin)                  │  · Server Actions / API      │
                                   │  · Middleware (rate limit,   │
                                   │    headers, sesión)          │
                                   └──────┬──────────┬────────────┘
                                          │          │
                       ┌──────────────────┘          └──────────────────┐
                       ▼                                                ▼
        ┌───────────────────────────┐                 ┌────────────────────────────┐
        │ POSTGRES (Supabase, NUEVO │                 │ INNGEST (colas y jobs)     │
        │ proyecto aislado por env) │                 │ · procesar webhooks pago   │
        │ · schema Drizzle          │                 │ · expirar vigencias        │
        │ · transacciones           │                 │ · sync iCal 15-30 min      │
        │   serializables / locks   │                 │ · OCR imágenes chat        │
        │ · auditoría append-only   │                 │ · link Pago 2 (24-48h)     │
        └───────────────────────────┘                 │ · notificaciones           │
                       ▲                              └────────────────────────────┘
                       │ webhooks (única fuente de verdad del pago)
        ┌──────────────┴────────────┐   ┌──────────────────┐   ┌──────────────────┐
        │ WOMPI (sandbox → prod)    │   │ TRUORA (KYC)     │   │ RESEND (email) + │
        │ · links de pago           │   │ · cédula CO      │   │ FCM (push) +     │
        │ · dispersión / split      │   │ · biometría      │   │ Twilio (OTP SMS) │
        └───────────────────────────┘   └──────────────────┘   └──────────────────┘

        Observabilidad: Sentry (errores) + logs estructurados (pino) + alertas
        de conciliación y webhooks fallidos.
```

## 2. Decisiones de stack (con justificación)

| Capa | Elección | Por qué (y alternativa descartada) |
|------|----------|-------------------------------------|
| Backend | **Next.js API routes + Server Actions (mismo repo)** | Equipo de 1, un solo deploy en Vercel, colocation con la UI ya construida. Un backend dedicado (NestJS) añade infra sin beneficio a este volumen; si el piloto escala, los servicios de dominio (`src/server/`) ya están desacoplados de HTTP y se extraen tal cual. |
| Base de datos | **PostgreSQL en Supabase — proyecto NUEVO y aislado por entorno** | Postgres real con locks de fila y transacciones serializables (lo que exige el modelo), backups gestionados, y tooling ya dominado por el equipo. Neon es igual de válido; se elige Supabase por operación conocida. ⚠️ Regla absoluta: proyectos PROPIOS de ESTADÍA — jamás los de BHIA/ContaAI. |
| ORM | **Drizzle** | SQL-first: las migraciones son SQL legible y auditable (crítico cuando el schema define reglas de dinero), tipos estrictos, sin runtime mágico. Prisma abstrae demasiado el SQL justo donde necesitamos `FOR UPDATE`/`SERIALIZABLE` explícitos. |
| Dinero | **Enteros = centavos COP** (`bigint` en DB, `number` entero en TS con guardas) | Jamás flotantes. Módulo central `src/lib/dinero` con invariante: todo split suma EXACTO (residuo de redondeo asignado por política, testeado). |
| Colas/jobs | **Inngest** | Corre nativo en Vercel (sin worker aparte), reintentos con backoff, idempotencia por evento, cron incluido (vigencias, iCal, conciliación diaria). Alternativa: QStash (más manual) o un worker en Railway (más infra). |
| Auth | **Auth.js v5** (+ passkeys/WebAuthn + OTP email/SMS) | El modelo de identidad ES el negocio (ban por cédula+biometría, alias, estados KYC): los usuarios deben vivir en NUESTRA tabla, no en un SaaS. Clerk acelera 1 semana pero acopla el mecanismo de ban a un tercero y cuesta por MAU. Auth.js con adapter Drizzle mantiene control total. |
| KYC | **Truora (sandbox)** | Cédula colombiana + biometría facial, API documentada para CO. Guardamos `truora_check_id` + resultado; **jamás biometría cruda**. Ban = hash(cédula) + id biométrico del proveedor en lista negra; el re-registro se rechaza al comparar contra esa lista en el callback del KYC. |
| Pasarela | **Wompi sandbox primero** (POC); si su dispersión/split no cubre el modelo → **MercadoPago Marketplace** (comparación documentada con código) | Wompi es Bancolombia: links de pago nativos + payouts. El modelo exige que el dinero NUNCA pase por cuentas propias (Superfinanciera). El código de dominio habla con una interfaz `PasarelaAdapter`; cambiar de proveedor no toca la lógica financiera. |
| Anti-fuga | Filtro **en servidor** (el de cliente queda como UX) + OCR en cola (tesseract.js en job Inngest; escalable a API de visión) | Un cliente modificado no puede saltarse la validación: el mensaje se persiste/entrega solo si pasa el filtro server-side. |
| Observabilidad | Sentry + pino (logs estructurados) + alertas Inngest (conciliación, webhooks fallidos) | |
| Validación | Zod en todos los endpoints/actions | |

## 3. Entornos (tres, con bases de datos separadas)

| Entorno | Frontend | DB | Pasarela | Secretos |
|---------|----------|----|----------|----------|
| **Desarrollo** | `next dev` local | Supabase proyecto `estadia-dev` (o Postgres local) | Wompi sandbox | `.env.local` (gitignored) |
| **Staging** | Vercel Preview (rama `staging`) | Supabase proyecto `estadia-staging` | Wompi sandbox | Vercel env (Preview) |
| **Producción** | Vercel Production (`main`) | Supabase proyecto `estadia-prod` | Wompi producción | Vercel env (Production) |

- Las migraciones se aplican con `drizzle-kit` por entorno; **nunca** a mano en prod.
- CI (GitHub Actions): tests en cada push; deploy automático a staging; producción solo con aprobación manual (environment protegido).
- `/api/health` expone huella de la DB para verificar aislamiento (mismo patrón probado en otros proyectos del equipo).

## 4. Reglas críticas de concurrencia (cómo se implementan)

1. **"El primero que acepta gana"** (solicitudes): `UPDATE solicitudes SET principal_aceptante_id = $1, estado = 'aceptada' WHERE id = $2 AND principal_aceptante_id IS NULL` — un solo UPDATE condicional; el segundo actor afecta 0 filas y recibe "ya fue tomada". Test de N aceptaciones simultáneas ⇒ exactamente 1 gana.
2. **"El primero que paga gana"** (calendario): el webhook del Pago 1 ejecuta UNA transacción con `SELECT ... FOR UPDATE` sobre los `calendario_dias` del rango: bloquear días + invalidar links solapados + registrar Split 1 + transición + outbox de notificaciones. Si otro pago ya tomó un día del rango ⇒ rollback, link INVALIDADO, checkout muestra "Fechas ya no disponibles", **sin cobro** (la transacción de la pasarela se anula/reembolsa automática si llegó a autorizarse: documentado en runbook).
3. **Idempotencia de webhooks:** tabla `eventos_pasarela` con `UNIQUE(pasarela_ref)`; el procesamiento hace INSERT primero — duplicado ⇒ no-op. Un webhook repetido JAMÁS duplica un split.
4. **Transiciones de estado solo por servidor:** los servicios validan contra la matriz de transiciones y escriben en `auditoria_reservas` (append-only) con actor, estado anterior/nuevo y timestamp.

## 5. Conciliación (cada peso rastreable)

- Por transacción: `monto = tarifa_neta + comision` y `split_principal + split_externo + split_app = comision` **exactos al centavo** (invariante del módulo dinero, con residuo por política: el residuo de redondeo va a la app).
- Job diario de conciliación: Σ entradas = Σ salidas + fee pasarela; si no cuadra al centavo ⇒ alerta a admin + Sentry.
- `splits` guarda estado de dispersión y referencia del payout de la pasarela.

## 6. Orden de ejecución y estado

| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 | Este documento + módulo dinero + schema + servicios core | ✅ en este commit |
| 1 | Auth.js + KYC Truora + alias + lista negra | 🟡 código base listo; **bloqueado por credenciales** (ver PENDIENTES) |
| 2 | DB real + máquina de estados + tests de concurrencia | ✅ código y tests; DB por provisionar |
| 3 | Wompi sandbox + webhooks + splits + carrera de pagos | 🟡 motor y tests con adapter fake listos; **bloqueado por cuenta Wompi sandbox** |
| 4 | Anti-fuga server + OCR en cola | 🟡 filtro server-side listo; OCR requiere Inngest activo |
| 5 | Panel /admin | pendiente |
| 6 | iCal + push + contratos PDF | pendiente |
| 7 | Seguridad, CI/CD, observabilidad | parcial (Zod, headers); CI al tener repo secrets |

Ver `docs/PENDIENTES-KUROSH.md` para la lista exacta de credenciales/cuentas que
desbloquean cada fase.
