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

## Novedades 2026-07-29 (4ª): REBRAND VISUAL — "Bosque + Oro" + logo real
- Nuevo tema por decisión de Kurosh (logo verde profundo + latón dorado):
  tokens redefinidos en globals.css — fondo #101b16, superficies verdes,
  texto crema #f1ebdd, MARCA dorado #c9a46b (token `tiffany` remapeado),
  semánticos intactos (esmeralda=confirmado, ámbar=pendiente). Física de
  tema oscuro (bordes + destellos, sombras negras), covers joya oscura,
  botones dorados con texto noche (combos bg/text corregidos en 22 archivos).
- LOGO real como componente `LogoCircle`: anillo "C" dorado + THE/IRCLE,
  con BRILLO DE LATÓN EN MOVIMIENTO (background-clip animado en el texto +
  gradiente SVG SMIL en el anillo; prefers-reduced-motion lo congela).
  Montado en landing, shell, registro, login, checkout, admin y errores.
- Íconos/favicon/OG/manifest/themeColor en verde+oro.

## Novedades 2026-07-29 (3ª): ANEXO II — IDENTIDAD PROTEGIDA
- Alias para TODOS (propietarios incluidos; wizard los revela; asegurarAlias
  al entrar al Deal Room en gestión directa).
- Anti-fuga detecta DIRECCIONES FÍSICAS (Calle 10 # 43-25, Cra 7 No 12-34,
  km 5 vía…, veredas) — 26 casos del filtro verdes, sin falsos positivos
  con fechas/cantidades.
- REVELACIÓN CONTROLADA: dirección cifrada en reposo + indicaciones de
  llegada; solo participantes con semáforo VERDE la ven (API + botones en
  semáforo y links). Migración 0005. Test e2e ampliado (verde revela,
  antes no, tercero jamás; cifrada en DB).

## Novedades 2026-07-29 (2ª): SPLIT 45/45/10
- Decisión de Kurosh: la comisión se reparte 45% Socio Comercial / 45% Socio
  de Ventas / 10% Plataforma (antes 50/40/10). Cambiado en el motor de
  centavos (BPS), el dominio del cliente, seed, TODOS los textos/ejemplos
  (landing $90.000/$90.000, registro, desglose, comisiones, OG image, admin)
  y la vitrina (splits e ingresos de demo recalculados). 98 tests al día.

## Novedades 2026-07-29: ANEXO I — OWNER DIRECT implementado
- Gestión directa por propiedad (`owner_direct`, migración 0004) + margen
  comercial mínimo → precio mínimo de venta aplicado en el servidor.
- Solo el dueño acepta/negocia sus propiedades OD (las solicitudes le
  notifican a él); el Deal Room lo reconoce ("Actúas como PROPIETARIO",
  slider desde el precio mínimo) vía guard multi-rol.
- El split paga al dueño neta + participación comercial (motor intacto).
  Cambio de modelo bloqueado con reservas activas. Alta con toggle "Gestión
  directa" + margen; página de socios avisa en propiedades OD.
- E2E en navegador: Cabaña del Lago Directa → solicitud → dueño acepta →
  oferta bajo el mínimo RECHAZADA → acuerdo $6.000.000 → pago → split
  CIR-2026-00412 con Andrés cobrando $2.500.000 + $250.000. 3 tests nuevos
  (98 en total). PENDIENTE decisión: proporción 60/40 del anexo vs 50/40
  vigente (regla #7).

## Novedades 2026-07-28: MODO VITRINA (data demo de vuelta, solo sin DB)
- Kurosh necesita MOSTRAR la plataforma llena a dueños/prospectos. Sin
  DATABASE_URL, los paneles se llenan con data de demostración coherente
  (marca CIR-, fechas jul–sep 2026): 6 propiedades, 4 reservas en todos los
  estados del semáforo, negociación con ofertas, links (activo/pagado/
  invalidado), ganancias por mes, splits, calendario/ficha con meses
  NAVEGABLES (estados deterministas por mes), chat con filtro anti-fuga
  interactivo (veredicto real del endpoint, strikes/ban visuales), checkout
  de vitrina con pago simulado visual, campanita con avisos estáticos y
  aliases CONDOR-472/GUACAMAYA-256 en el shell.
- REGLA DE ORO INTACTA: con DATABASE_URL la data real reemplaza TODO esto
  automáticamente (mismo mecanismo de fallback); las acciones reales
  (check-in, tarifa, vínculos, saldo) siguen apagadas en vitrina.

## Novedades 2026-07-21 (7ª): VELOCIDAD Y CONCURRENCIA (revisión profunda)
- **Revisión adversarial multi-archivo** del código nuevo: 14 hallazgos; los
  que importaban quedaron corregidos:
  - [CRÍTICO] transición del saldo y cancelación del reembolso movidas AL
    INTERIOR de la transacción del dinero (la reserva queda lockeada — antes
    había ventana de carrera entre la tx y el .then()).
  - [ALTO] `contraofertar` ahora lockea la solicitud (FOR UPDATE) al validar
    participantes.
  - N+1 eliminados: notificaciones a principales en paralelo, contra-splits
    en UN insert, vigencias con select en batch.
- **FIX crítico de build**: /app y /admin con `force-dynamic` — varias páginas
  se prerenderizaban ESTÁTICAS y con DATABASE_URL en Vercel habrían quedado
  congeladas con datos del build.
- **13 índices nuevos** (migración 0003) según los WHERE/JOIN reales:
  reservas por propiedad/principal/externo, splits por beneficiario,
  solicitudes, transacciones, chat por solicitud, vínculos, calendario por
  reserva, tarifas, intentos de fuga.
- **Capa de datos paralelizada** (Promise.all en propiedades/reservas/
  propietario/chat). Paneles en build de producción: **12–22 ms**.
- **Fuentes**: Archivo y JetBrains con `display: optional` — el repintado
  tardío del swap contaba como LCP (element render delay 1.269 → 228 ms,
  FCP 0,9 s). Lighthouse 93–94 / 100 / 100 / 100.
- Suite: **95 tests** verdes.

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

## 2026-07-30 — Landing "Cómo funciona" + huéspedes adicionales
- Landing: nueva sección "Cómo funciona" (camino de 5 pasos por rol);
  participación de la plataforma retirada de TODO lo visible (stats, barra,
  tabla del modelo, FlujoDinero, DesgloseSplit).
- Huéspedes adicionales (audio del socio): tarifa por persona-noche del
  propietario, sumada a la neta antes de negociar. Migración 0006 + servicio +
  API + formulario + ficha + 3 tests (106 verdes).
