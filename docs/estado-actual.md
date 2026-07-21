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

## Novedades 2026-07-21 (6ª): reembolso íntegro, logout, salud
- **FIX de integridad: el reembolso ahora CANCELA de verdad** — antes revertía
  el dinero (contra-splits) pero dejaba la reserva viva y el calendario
  bloqueado para siempre. Ahora: reserva → CANCELADA (auditada con refundRef),
  días reservado_app → disponibles, links activos invalidados y campanita a
  las 3 partes. Test extendido: reserva CANCELADA + día liberado.
- **Cerrar sesión**: botón "Salir" en el shell (solo con auth exigida) →
  DELETE /api/auth/sesion.
- **Rate limit por IP en OTP** (además del límite por email en DB).
- **/api/salud** para monitoreo externo: estado de DB (latencia), drivers
  activos y versión del deploy — sin secretos.
- Suite: **95 tests** verdes.

## Novedades 2026-07-21 (5ª): búsqueda real por fechas, tarifa editable, banco y contratos
- **Búsqueda con disponibilidad REAL**: rango desde/hasta en la búsqueda del
  externo; el servidor excluye toda propiedad con algún día no-disponible en
  el rango (mismo criterio del lock del webhook). Verificado: la reserva
  pagada 27–30 jul desaparece del resultado; una solicitud sin pagar NO
  bloquea (sin holds). La ficha abre en el mes buscado.
- **Tarifa editable por TEMPORADAS**: "Guardar tarifa" en la calculadora
  (cierra la vigencia actual y abre una desde hoy — histórico intacto) +
  publicar/despublicar desde la tarjeta del panel. PATCH /api/propiedades
  con edición parcial de todos los campos.
- **Cuenta bancaria del registro**: el paso Banco del wizard ya PERSISTE
  (AES-GCM en reposo, certificada=false hasta que el equipo la valide).
- **Contrato PDF descargable**: GET /api/contratos/[reservaId] con
  puedeVerContrato (solo propietario/admin) + botón "Contrato PDF ↓" en el
  semáforo desde el anticipo. Verificado: PDF 1.7 real.
- Suite: **95 tests** verdes.

## Novedades 2026-07-21 (4ª): meses navegables, campanita e iCal en la UI
- **Navegación de meses** en la ficha del externo y el calendario del
  propietario (`?mes=YYYY-MM`, flechas ‹ ›, clamp a +18 meses): ya se pueden
  pedir/bloquear fechas de cualquier mes futuro.
- **Notificaciones IN-APP** (tabla `notificaciones`, migración 0002):
  campanita en el shell con badge de no-leídas, dropdown y marcar-leído.
  Emisión real en: solicitud entrante (a TODOS los principales vinculados),
  solicitud aceptada (al externo), contraoferta (a la contraparte), precio
  acordado (al emisor) y pagos (a las 3 partes). Verificado en navegador con
  el evento real. Falla en silencio: jamás tumba la operación que la origina.
- **iCal en la UI del calendario**: URL de exportación copiable (token HMAC,
  para pegar en Airbnb/Booking) + conectar/quitar calendarios externos que
  el cron importa cada 20 min. Verificado en navegador.
- Pase móvil de las pantallas nuevas (390px) OK.
- Suite: **95 tests** verdes.

## Novedades 2026-07-21 (3ª): vigencias duras, cierre del ciclo, admin y auth
- **Vigencias DURAS**: un link vencido JAMÁS se cobra (el webhook lo marca
  expirado sin mover un peso) y una oferta vencida no se acepta. Cron
  `/api/cron/vigencias` cada 10 min: expira solicitudes/ofertas/links, la
  reserva del link 1 vencido EXPIRA auditada, el saldo vencido se REGENERA
  (misma fila) y las reservas con salida cumplida se COMPLETAN solas. 4 tests.
- **Cierre del ciclo en el panel**: botones del propietario en el semáforo
  (PAGO_COMPLETO → "Confirmar check-in" → "Marcar completada"), API con
  pertenencia verificada, máquina de estados intacta. Verificado: CIR-2026-
  00401 → COMPLETADA con auditoría de actor humano.
- **Admin operativo sin SQL**: la consola /admin/verificaciones otorga el
  sello Verificada (server action). FIX: en dev/preview sin MODO_AUTH las
  acciones usan el admin de desarrollo (usuario real `admin@thecircle.dev`,
  FK de auditoría intacta); con auth exigida, sesión admin + TOTP como siempre.
- **MODO_AUTH=exigida verificado e2e en navegador**: /app sin sesión → login;
  OTP real (bandeja dev) → sesión httpOnly → aterriza en SU panel; el shell
  muestra SOLO las secciones de su rol; /app/principal ajeno rebota a su panel.
- Suite: **95 tests** verdes.

## Novedades 2026-07-21 (2ª): SIN DATA DEMO — lista para data real
- **Toda la data ficticia fue eliminada** (fincas, reservas, CONDOR-472, etc.):
  sin DB cada panel muestra su estado vacío honesto; con DB, solo data real.
- **Alta real construida** (lo que faltaba para ingresar data):
  `crearPropiedad` (nace con tarifa; suscripción piloto se activa sola) +
  formulario `/app/propietario/nueva`; vincular/desvincular principales por
  ALIAS con regla #4 en servidor (`/api/propiedades[/vinculos]`).
- Checkout sin DB → 404 (sin links ficticios); registro sin DB → aviso "en
  preparación"; landing con CTAs "plataforma" (el copy ilustrativo se queda).
- **PRUEBA DEFINITIVA en navegador con DB VACÍA (cero seed)**: registro de 3
  usuarios reales → Finca Vista Real creada por el formulario ($1.200.000
  neta) → IGUANA-149 vinculado por alias → BUHO-232 solicita 27–30 jul →
  aceptación → negociación $4.100.000 → anticipo $2.050.000 → saldo →
  **PAGO_COMPLETO/verde**, splits con beneficiarios reales por nombre,
  calendario bloqueado y contrato generado. Código CIR-2026-00401.
- FIX rebrand: el generador de códigos producía aún EST- → CIR-.

## Novedades 2026-07-21: REBRAND → THE CIRCLE
- La app se llama **THE CIRCLE** (decisión de Kurosh). Rebrand completo en
  producto: wordmark, metadata/OG/manifest, íconos nuevos (anillo sobre
  Tiffany), emails, contratos, checkout y códigos de reserva `CIR-YYYY-NNNNN`
  (antes EST-). Infra intacta a propósito: repo/Vercel `estadia-b2b`, cookie
  de sesión y correos del seed — renombrarlos es decisión de infraestructura
  aparte (dominio/proyecto Vercel los decide Kurosh).

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
