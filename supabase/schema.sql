-- ═══════════════════════════════════════════════════════════════════════════
-- ESTADÍA — Marketplace B2B de Rentas Cortas (Antioquia)
-- Schema PostgreSQL de referencia (§9 de la especificación).
-- NO aplicado aún: listo para el proyecto Supabase/Postgres propio de ESTADÍA.
-- Principios: calendario transaccional (locks de fila), auditoría inmutable,
-- identidad real solo en backend, alias irrepetibles, splits idempotentes.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists btree_gist; -- exclusion constraints sobre rangos

-- ─── Identidad ───────────────────────────────────────────────────────────────

create type rol_usuario as enum ('propietario', 'principal', 'externo');
create type estado_veto as enum ('activo', 'baneado_perpetuo');

create table usuarios (
  id                uuid primary key default gen_random_uuid(),
  creado_en         timestamptz not null default now(),
  nombre_real       text not null,          -- solo backend/contratos/DIAN
  cedula            text not null unique,
  biometria_ref     text,                   -- referencia al proveedor KYC (Truora/Mati)
  telefono          text not null,          -- solo notificaciones de la plataforma
  email             text not null unique,
  whatsapp          text,
  roles             rol_usuario[] not null,
  estado            estado_veto not null default 'activo',
  kyc_verificado_en timestamptz
);

-- Lista negra a la IDENTIDAD (no a la cuenta): el ban es a cédula + biometría.
create table lista_negra_identidad (
  cedula        text primary key,
  biometria_ref text,
  motivo        text not null,
  evidencia     jsonb,
  baneado_en    timestamptz not null default now()
);

-- Alias: único global, irrepetible para siempre (retirados jamás se reasignan).
create table alias (
  alias        text primary key,
  usuario_id   uuid references usuarios(id), -- NULL si quedó retirado
  avatar_id    smallint not null,
  asignado_en  timestamptz not null default now(),
  retirado     boolean not null default false,
  retirado_en  timestamptz,
  constraint alias_formato check (alias ~ '^[A-Z]{3,12}-[0-9]{3}$')
);
create unique index alias_un_activo_por_usuario
  on alias(usuario_id) where not retirado;

create table cuentas_bancarias (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references usuarios(id),
  banco         text not null,
  numero_cifrado text not null,
  certificada   boolean not null default false,
  validada_en   timestamptz
);

-- ─── Propiedades y calendario ────────────────────────────────────────────────

create table suscripciones (
  id             uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id),
  plan           text not null,
  estado         text not null check (estado in ('activa','vencida','cancelada')),
  renueva_en     date not null
);

create table propiedades (
  id              uuid primary key default gen_random_uuid(),
  propietario_id  uuid not null references usuarios(id),
  nombre          text not null,
  municipio       text not null,
  zona            text not null,
  tipo            text not null check (tipo in ('finca','apartamento','casa','glamping')),
  capacidad       smallint not null,
  habitaciones    smallint not null,
  banos           smallint not null,
  amenidades      text[] not null default '{}',
  reglas          text[] not null default '{}',
  cert_tradicion_libertad text,             -- → sello "Propiedad Verificada"
  verificada      boolean not null default false,
  publicada       boolean not null default false, -- exige suscripción activa
  creada_en       timestamptz not null default now()
);

-- Tarifa neta por temporada: el propietario SIEMPRE la recibe completa.
create table tarifas (
  id           uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references propiedades(id),
  rango        daterange not null,
  neta_noche   bigint not null check (neta_noche > 0), -- COP
  exclude using gist (propiedad_id with =, rango with &&)
);

-- 3–5 comisionistas principales por propiedad, por invitación.
create table vinculos_comisionista (
  propiedad_id uuid not null references propiedades(id),
  principal_id uuid not null references usuarios(id),
  estado       text not null default 'activo' check (estado in ('activo','removido')),
  creado_en    timestamptz not null default now(),
  primary key (propiedad_id, principal_id)
);

create type estado_dia as enum ('disponible','reservado_app','bloqueado_manual','bloqueado_ical');

-- Una sola fuente de verdad de disponibilidad. Bloqueo automático = Pago 1.
create table calendario_dias (
  propiedad_id uuid not null references propiedades(id),
  fecha        date not null,
  estado       estado_dia not null default 'disponible',
  reserva_id   uuid, -- FK diferida a reservas
  actualizado  timestamptz not null default now(),
  primary key (propiedad_id, fecha)
);

create table sincronizaciones_ical (
  id           uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references propiedades(id),
  url          text not null,
  direccion    text not null check (direccion in ('import','export','bidireccional')),
  ultima_sync  timestamptz
);

-- ─── Solicitud → negociación → reserva ───────────────────────────────────────

create table solicitudes (
  id            uuid primary key default gen_random_uuid(),
  externo_id    uuid not null references usuarios(id),
  propiedad_id  uuid not null references propiedades(id),
  rango         daterange not null,
  huespedes     smallint not null,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','aceptada','expirada','rechazada')),
  principal_aceptante_id uuid references usuarios(id), -- el primero que acepta
  creada_en     timestamptz not null default now(),
  vence_en      timestamptz not null
);

create table negociaciones (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null unique references solicitudes(id),
  estado          text not null default 'abierta'
                  check (estado in ('abierta','acordada','expirada')),
  precio_acordado bigint,
  tarifa_neta     bigint not null
);

-- Registro INMUTABLE de ofertas: solo INSERT (sin UPDATE/DELETE por RLS/grants).
create table ofertas (
  id             uuid primary key default gen_random_uuid(),
  negociacion_id uuid not null references negociaciones(id),
  emisor_id      uuid not null references usuarios(id),
  monto          bigint not null,
  vence_en       timestamptz not null,
  estado         text not null default 'activa'
                 check (estado in ('activa','contraofertada','aceptada','expirada')),
  creada_en      timestamptz not null default now()
);

create type estado_reserva as enum (
  'SOLICITADA','ACEPTADA','NEGOCIACION','PRECIO_ACORDADO','LINK_1_ENVIADO',
  'ANTICIPO_PAGADO','SALDO_LINK_ENVIADO','PAGO_COMPLETO','CHECK_IN','COMPLETADA',
  'EXPIRADA','INVALIDADA','RECHAZADA','CANCELADA'
);

create table reservas (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique, -- EST-YYYY-NNNNN
  solicitud_id  uuid not null references solicitudes(id),
  propiedad_id  uuid not null references propiedades(id),
  principal_id  uuid not null references usuarios(id),
  externo_id    uuid not null references usuarios(id),
  rango         daterange not null,
  estado        estado_reserva not null default 'PRECIO_ACORDADO',
  precio_final  bigint not null,
  tarifa_neta   bigint not null,
  comision      bigint generated always as (precio_final - tarifa_neta) stored,
  creada_en     timestamptz not null default now()
);

-- Dos reservas PAGADAS jamás se solapan (el lock real ocurre en la transacción
-- del webhook del Pago 1, con SELECT ... FOR UPDATE sobre calendario_dias).
create index reservas_propiedad_rango on reservas using gist (propiedad_id, rango);

-- ─── Dinero ──────────────────────────────────────────────────────────────────

create table links_de_pago (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null references reservas(id),
  mitad       smallint not null check (mitad in (1,2)),
  monto       bigint not null,
  url         text not null unique,
  estado      text not null default 'activo'
              check (estado in ('activo','pagado','expirado','invalidado')),
  vence_en    timestamptz not null,
  unique (reserva_id, mitad)
);

-- Webhooks de pasarela = ÚNICA fuente de confirmación. Idempotencia obligatoria.
create table transacciones (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid not null references links_de_pago(id),
  pasarela_ref text not null unique, -- clave de idempotencia
  monto        bigint not null,
  estado       text not null check (estado in ('aprobada','rechazada','reversada')),
  webhook_en   timestamptz not null default now()
);

-- Split 50/40/10 + tarifa neta: la pasarela dispersa directo a cada beneficiario.
create table splits (
  id              uuid primary key default gen_random_uuid(),
  transaccion_id  uuid not null references transacciones(id),
  beneficiario_id uuid references usuarios(id), -- NULL = la plataforma
  concepto        text not null
                  check (concepto in ('tarifa_neta','comision_principal','comision_externo','comision_app')),
  monto           bigint not null,
  dispersado      boolean not null default false,
  dispersado_en   timestamptz
);

create table contratos (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null unique references reservas(id),
  tipo        text not null check (tipo in ('vivienda_turistica','arrendamiento_corto')),
  pdf_url     text not null, -- con identidades REALES; distribución restringida
  hash_sha256 text not null,
  generado_en timestamptz not null default now()
);

-- ─── Comunicación y anti-fuga ────────────────────────────────────────────────

create table mensajes_chat (
  id              uuid primary key default gen_random_uuid(),
  reserva_id      uuid references reservas(id),
  solicitud_id    uuid references solicitudes(id),
  emisor_id       uuid not null references usuarios(id),
  contenido       text not null,
  bloqueado       boolean not null default false, -- filtro NLP pre-envío
  flags           jsonb not null default '[]',
  ocr_resultado   jsonb,
  enviado_en      timestamptz not null default now()
);

create table intentos_fuga (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id),
  evidencia   jsonb not null,
  accion      text not null check (accion in ('bloqueado','advertido','ban_perpetuo')),
  registrado  timestamptz not null default now()
);

create table eventos_reputacion (
  id         uuid primary key default gen_random_uuid(),
  alias      text not null references alias(alias),
  tipo       text not null,
  valor      numeric not null,
  reserva_id uuid references reservas(id),
  creado_en  timestamptz not null default now()
);

-- ─── Configuración ───────────────────────────────────────────────────────────

create table configuracion_plataforma (
  clave text primary key,
  valor jsonb not null
);

insert into configuracion_plataforma (clave, valor) values
  ('piso_comision',        '{"activo": false, "pct": 0.08}'),
  ('vigencias',            '{"solicitud_min": 30, "oferta_horas": 6, "link_horas": 24, "saldo_anticipacion_horas": 36}'),
  ('split',                '{"principal": 0.5, "externo": 0.4, "app": 0.1}'),
  ('pasarela',             '{"pct_estimado": 0.03, "candidatas": ["wompi","mercadopago","payu"]}');
