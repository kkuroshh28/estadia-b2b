/**
 * Schema de producción — THE CIRCLE (Drizzle · PostgreSQL).
 * Todo dinero: BIGINT en CENTAVOS COP (ver src/lib/dinero).
 * Auditoría y ofertas: append-only (sin UPDATE/DELETE — se refuerza con grants).
 */
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const rolEnum = pgEnum("rol", ["propietario", "principal", "externo", "admin"]);
export const estadoUsuarioEnum = pgEnum("estado_usuario", [
  "pendiente_kyc",
  "activo",
  "baneado",
  "kyc_rechazado",
]);
export const estadoDiaEnum = pgEnum("estado_dia", [
  "disponible",
  "reservado_app",
  "bloqueado_manual",
  "bloqueado_ical",
]);
export const estadoReservaEnum = pgEnum("estado_reserva", [
  "SOLICITADA",
  "ACEPTADA",
  "NEGOCIACION",
  "PRECIO_ACORDADO",
  "LINK_1_ENVIADO",
  "ANTICIPO_PAGADO",
  "SALDO_LINK_ENVIADO",
  "PAGO_COMPLETO",
  "CHECK_IN",
  "COMPLETADA",
  "EXPIRADA",
  "INVALIDADA",
  "RECHAZADA",
  "CANCELADA",
]);
export const estadoLinkEnum = pgEnum("estado_link", [
  "activo",
  "pagado",
  "expirado",
  "invalidado",
]);
export const estadoSolicitudEnum = pgEnum("estado_solicitud", [
  "pendiente",
  "aceptada",
  "expirada",
  "rechazada",
]);
export const estadoOfertaEnum = pgEnum("estado_oferta", [
  "activa",
  "contraofertada",
  "aceptada",
  "expirada",
]);

// ─── Identidad ───────────────────────────────────────────────────────────────

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  nombreReal: text("nombre_real").notNull(), // solo backend/contratos/DIAN
  cedulaHash: text("cedula_hash").notNull().unique(), // hash — nunca cédula en claro en índices compartidos
  cedulaCifrada: text("cedula_cifrada").notNull(), // AES-GCM, clave en env
  email: text("email").notNull().unique(),
  telefonoCifrado: text("telefono_cifrado").notNull(),
  roles: rolEnum("rol").array().notNull(),
  estado: estadoUsuarioEnum("estado").notNull().default("pendiente_kyc"),
  kycProveedorId: text("kyc_proveedor_id"), // truora_check_id — jamás biometría cruda
  kycVerificadoEn: timestamp("kyc_verificado_en", { withTimezone: true }),
  totpSecret: text("totp_secret"), // 2FA obligatorio para rol admin
});

// ─── Auth (sesiones propias: el modelo de identidad ES el negocio) ───────────

export const otps = pgTable("otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  codigoHash: text("codigo_hash").notNull(),
  intentos: smallint("intentos").notNull().default(0),
  venceEn: timestamp("vence_en", { withTimezone: true }).notNull(),
  usado: boolean("usado").notNull().default(false),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const sesiones = pgTable("sesiones", {
  tokenHash: text("token_hash").primaryKey(), // solo el hash — jamás el token
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  adminElevada: boolean("admin_elevada").notNull().default(false), // tras TOTP
  venceEn: timestamp("vence_en", { withTimezone: true }).notNull(),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
});

/** Bandeja de notificaciones del driver simulado (visible en /admin/dev). */
/** Notificaciones IN-APP por usuario (la campanita). */
export const notificaciones = pgTable(
  "notificaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
    tipo: text("tipo").notNull(), // solicitud | aceptada | oferta | acuerdo | pago
    titulo: text("titulo").notNull(),
    cuerpo: text("cuerpo").notNull(),
    url: text("url"),
    leida: boolean("leida").notNull().default(false),
    creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notificaciones_por_usuario").on(t.usuarioId, t.leida)],
);

export const notificacionesDev = pgTable("notificaciones_dev", {
  id: uuid("id").primaryKey().defaultRandom(),
  canal: text("canal").notNull(), // email | push | sms
  destinatario: text("destinatario").notNull(),
  asunto: text("asunto").notNull(),
  cuerpo: text("cuerpo").notNull(),
  enviadaEn: timestamp("enviada_en", { withTimezone: true }).notNull().defaultNow(),
});

export const alertasAdmin = pgTable("alertas_admin", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: text("tipo").notNull(), // conflicto_ical | conciliacion | reserva_baneado
  detalle: jsonb("detalle").notNull(),
  resuelta: boolean("resuelta").notNull().default(false),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
});

/** Auditoría append-only de TODA acción admin. */
export const auditoriaAdmin = pgTable("auditoria_admin", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => usuarios.id),
  accion: text("accion").notNull(),
  detalle: jsonb("detalle"),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
});

/** Bytes de PDFs de contratos (sin blob storage externo todavía). */
export const contratosBlob = pgTable("contratos_blob", {
  contratoId: uuid("contrato_id").primaryKey().references(() => contratos.id),
  bytesBase64: text("bytes_base64").notNull(),
});

/** Ban perpetuo A LA IDENTIDAD: hash de cédula + id biométrico del proveedor. */
export const listaNegraIdentidad = pgTable("lista_negra_identidad", {
  cedulaHash: text("cedula_hash").primaryKey(),
  biometriaProveedorId: text("biometria_proveedor_id"),
  motivo: text("motivo").notNull(),
  evidencia: jsonb("evidencia"),
  baneadoEn: timestamp("baneado_en", { withTimezone: true }).notNull().defaultNow(),
});

/** Alias único global e IRREPETIBLE: los retirados jamás se reasignan. */
export const alias = pgTable(
  "alias",
  {
    alias: text("alias").primaryKey(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    avatarId: smallint("avatar_id").notNull(),
    asignadoEn: timestamp("asignado_en", { withTimezone: true }).notNull().defaultNow(),
    retirado: boolean("retirado").notNull().default(false),
    retiradoEn: timestamp("retirado_en", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("alias_un_activo_por_usuario")
      .on(t.usuarioId)
      .where(sqlNoRetirado()),
  ],
);

export const cuentasBancarias = pgTable("cuentas_bancarias", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  banco: text("banco").notNull(),
  numeroCifrado: text("numero_cifrado").notNull(), // AES-GCM en reposo
  certificada: boolean("certificada").notNull().default(false),
  validadaEn: timestamp("validada_en", { withTimezone: true }),
});

// ─── Propiedades y calendario ────────────────────────────────────────────────

export const suscripciones = pgTable("suscripciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  propietarioId: uuid("propietario_id").notNull().references(() => usuarios.id),
  plan: text("plan").notNull(),
  estado: text("estado").notNull(), // activa | vencida | cancelada
  renuevaEn: date("renueva_en").notNull(),
  pasarelaSubRef: text("pasarela_sub_ref"),
});

export const propiedades = pgTable("propiedades", {
  id: uuid("id").primaryKey().defaultRandom(),
  propietarioId: uuid("propietario_id").notNull().references(() => usuarios.id),
  nombre: text("nombre").notNull(),
  municipio: text("municipio").notNull(),
  zona: text("zona").notNull(),
  tipo: text("tipo").notNull(),
  capacidad: smallint("capacidad").notNull(),
  habitaciones: smallint("habitaciones").notNull(),
  banos: smallint("banos").notNull(),
  amenidades: text("amenidades").array().notNull().default([]),
  reglas: text("reglas").array().notNull().default([]),
  certTradicionLibertadUrl: text("cert_tradicion_libertad_url"),
  verificada: boolean("verificada").notNull().default(false),
  publicada: boolean("publicada").notNull().default(false), // exige suscripción activa
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
});

/** Tarifa neta por temporada, en CENTAVOS. Sin solapamiento (constraint en SQL). */
export const tarifas = pgTable("tarifas", {
  id: uuid("id").primaryKey().defaultRandom(),
  propiedadId: uuid("propiedad_id").notNull().references(() => propiedades.id),
  desde: date("desde").notNull(),
  hasta: date("hasta").notNull(),
  netaNocheCentavos: bigint("neta_noche_centavos", { mode: "number" }).notNull(),
});

/** 3–5 principales por propiedad (mín/máx validado en servicio + trigger). */
export const vinculosComisionista = pgTable(
  "vinculos_comisionista",
  {
    propiedadId: uuid("propiedad_id").notNull().references(() => propiedades.id),
    principalId: uuid("principal_id").notNull().references(() => usuarios.id),
    estado: text("estado").notNull().default("activo"), // activo | removido
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vinculo_unico").on(t.propiedadId, t.principalId)],
);

/** Una fila por día — la fuente ÚNICA de disponibilidad. Lock de fila = la regla. */
export const calendarioDias = pgTable(
  "calendario_dias",
  {
    propiedadId: uuid("propiedad_id").notNull().references(() => propiedades.id),
    fecha: date("fecha").notNull(),
    estado: estadoDiaEnum("estado").notNull().default("disponible"),
    reservaId: uuid("reserva_id"),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("calendario_pk").on(t.propiedadId, t.fecha)],
);

export const sincronizacionesIcal = pgTable("sincronizaciones_ical", {
  id: uuid("id").primaryKey().defaultRandom(),
  propiedadId: uuid("propiedad_id").notNull().references(() => propiedades.id),
  url: text("url").notNull(),
  direccion: text("direccion").notNull(), // import | export | bidireccional
  ultimaSync: timestamp("ultima_sync", { withTimezone: true }),
});

// ─── Solicitud → negociación → reserva ───────────────────────────────────────

export const solicitudes = pgTable("solicitudes", {
  id: uuid("id").primaryKey().defaultRandom(),
  externoId: uuid("externo_id").notNull().references(() => usuarios.id),
  propiedadId: uuid("propiedad_id").notNull().references(() => propiedades.id),
  desde: date("desde").notNull(),
  hasta: date("hasta").notNull(),
  huespedes: smallint("huespedes").notNull(),
  estado: estadoSolicitudEnum("estado").notNull().default("pendiente"),
  // "El primero que acepta gana": UPDATE condicional WHERE principal_aceptante_id IS NULL
  principalAceptanteId: uuid("principal_aceptante_id").references(() => usuarios.id),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
  venceEn: timestamp("vence_en", { withTimezone: true }).notNull(),
});

export const negociaciones = pgTable("negociaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  solicitudId: uuid("solicitud_id").notNull().unique().references(() => solicitudes.id),
  estado: text("estado").notNull().default("abierta"), // abierta | acordada | expirada
  precioAcordadoCentavos: bigint("precio_acordado_centavos", { mode: "number" }),
  tarifaNetaCentavos: bigint("tarifa_neta_centavos", { mode: "number" }).notNull(),
});

/** Registro INMUTABLE: solo INSERT (grants revocan UPDATE/DELETE). */
export const ofertas = pgTable("ofertas", {
  id: uuid("id").primaryKey().defaultRandom(),
  negociacionId: uuid("negociacion_id").notNull().references(() => negociaciones.id),
  emisorId: uuid("emisor_id").notNull().references(() => usuarios.id),
  montoCentavos: bigint("monto_centavos", { mode: "number" }).notNull(),
  venceEn: timestamp("vence_en", { withTimezone: true }).notNull(),
  estado: estadoOfertaEnum("estado").notNull().default("activa"),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
});

export const reservas = pgTable("reservas", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(), // CIR-YYYY-NNNNN
  solicitudId: uuid("solicitud_id").notNull().references(() => solicitudes.id),
  propiedadId: uuid("propiedad_id").notNull().references(() => propiedades.id),
  principalId: uuid("principal_id").notNull().references(() => usuarios.id),
  externoId: uuid("externo_id").notNull().references(() => usuarios.id),
  desde: date("desde").notNull(),
  hasta: date("hasta").notNull(),
  estado: estadoReservaEnum("estado").notNull().default("PRECIO_ACORDADO"),
  precioFinalCentavos: bigint("precio_final_centavos", { mode: "number" }).notNull(),
  tarifaNetaCentavos: bigint("tarifa_neta_centavos", { mode: "number" }).notNull(),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
});

/** Auditoría APPEND-ONLY de transiciones: actor, anterior → nuevo, cuándo. */
export const auditoriaReservas = pgTable(
  "auditoria_reservas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservaId: uuid("reserva_id").notNull().references(() => reservas.id),
    actor: text("actor").notNull(), // usuario_id | 'sistema' | 'webhook:pasarela'
    estadoAnterior: estadoReservaEnum("estado_anterior"),
    estadoNuevo: estadoReservaEnum("estado_nuevo").notNull(),
    detalle: jsonb("detalle"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auditoria_por_reserva").on(t.reservaId)],
);

// ─── Dinero ──────────────────────────────────────────────────────────────────

export const linksDePago = pgTable(
  "links_de_pago",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservaId: uuid("reserva_id").notNull().references(() => reservas.id),
    mitad: smallint("mitad").notNull(), // 1 | 2
    montoCentavos: bigint("monto_centavos", { mode: "number" }).notNull(),
    url: text("url").notNull().unique(),
    pasarelaLinkRef: text("pasarela_link_ref"),
    estado: estadoLinkEnum("estado").notNull().default("activo"),
    venceEn: timestamp("vence_en", { withTimezone: true }).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("link_por_mitad").on(t.reservaId, t.mitad)],
);

/**
 * Idempotencia de webhooks: UNIQUE(pasarela_ref). El procesador hace INSERT
 * primero; un duplicado viola el índice ⇒ no-op. JAMÁS se duplica un split.
 */
export const eventosPasarela = pgTable("eventos_pasarela", {
  pasarelaRef: text("pasarela_ref").primaryKey(),
  tipo: text("tipo").notNull(),
  payload: jsonb("payload").notNull(),
  procesadoEn: timestamp("procesado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const transacciones = pgTable("transacciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  linkId: uuid("link_id").notNull().references(() => linksDePago.id),
  pasarelaRef: text("pasarela_ref").notNull().unique(),
  montoCentavos: bigint("monto_centavos", { mode: "number" }).notNull(),
  estado: text("estado").notNull(), // aprobada | rechazada | reversada
  webhookEn: timestamp("webhook_en", { withTimezone: true }).notNull().defaultNow(),
});

export const splits = pgTable("splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  transaccionId: uuid("transaccion_id").notNull().references(() => transacciones.id),
  beneficiarioId: uuid("beneficiario_id").references(() => usuarios.id), // NULL = plataforma
  concepto: text("concepto").notNull(), // tarifa_neta | comision_principal | comision_externo | comision_app
  montoCentavos: bigint("monto_centavos", { mode: "number" }).notNull(),
  dispersado: boolean("dispersado").notNull().default(false),
  pasarelaPayoutRef: text("pasarela_payout_ref"),
  dispersadoEn: timestamp("dispersado_en", { withTimezone: true }),
});

export const contratos = pgTable("contratos", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservaId: uuid("reserva_id").notNull().unique().references(() => reservas.id),
  tipo: text("tipo").notNull(), // vivienda_turistica | arrendamiento_corto
  pdfUrl: text("pdf_url").notNull(),
  hashSha256: text("hash_sha256").notNull(),
  generadoEn: timestamp("generado_en", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Comunicación y anti-fuga ────────────────────────────────────────────────

export const mensajesChat = pgTable(
  "mensajes_chat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservaId: uuid("reserva_id").references(() => reservas.id),
    solicitudId: uuid("solicitud_id").references(() => solicitudes.id),
    emisorId: uuid("emisor_id").notNull().references(() => usuarios.id),
    contenido: text("contenido").notNull(),
    bloqueado: boolean("bloqueado").notNull().default(false), // filtro SERVER-side
    flags: jsonb("flags").notNull().default([]),
    ocrEstado: text("ocr_estado"), // null | en_revision | aprobado | bloqueado
    enviadoEn: timestamp("enviado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_por_reserva").on(t.reservaId)],
);

export const intentosFuga = pgTable("intentos_fuga", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  evidencia: jsonb("evidencia").notNull(),
  accion: text("accion").notNull(), // bloqueado | ban_perpetuo
  registradoEn: timestamp("registrado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const eventosReputacion = pgTable("eventos_reputacion", {
  id: uuid("id").primaryKey().defaultRandom(),
  alias: text("alias").notNull().references(() => alias.alias),
  tipo: text("tipo").notNull(),
  valor: integer("valor").notNull(),
  reservaId: uuid("reserva_id").references(() => reservas.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Configuración ───────────────────────────────────────────────────────────

/** Incluye piso_comision (activo=false, programado) y vigencias. */
export const configuracionPlataforma = pgTable("configuracion_plataforma", {
  clave: text("clave").primaryKey(),
  valor: jsonb("valor").notNull(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Helper para el índice parcial del alias (drizzle necesita SQL crudo aquí)
import { sql } from "drizzle-orm";
function sqlNoRetirado() {
  return sql`NOT retirado`;
}
