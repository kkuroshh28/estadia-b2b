CREATE TYPE "public"."estado_dia" AS ENUM('disponible', 'reservado_app', 'bloqueado_manual', 'bloqueado_ical');--> statement-breakpoint
CREATE TYPE "public"."estado_link" AS ENUM('activo', 'pagado', 'expirado', 'invalidado');--> statement-breakpoint
CREATE TYPE "public"."estado_oferta" AS ENUM('activa', 'contraofertada', 'aceptada', 'expirada');--> statement-breakpoint
CREATE TYPE "public"."estado_reserva" AS ENUM('SOLICITADA', 'ACEPTADA', 'NEGOCIACION', 'PRECIO_ACORDADO', 'LINK_1_ENVIADO', 'ANTICIPO_PAGADO', 'SALDO_LINK_ENVIADO', 'PAGO_COMPLETO', 'CHECK_IN', 'COMPLETADA', 'EXPIRADA', 'INVALIDADA', 'RECHAZADA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."estado_solicitud" AS ENUM('pendiente', 'aceptada', 'expirada', 'rechazada');--> statement-breakpoint
CREATE TYPE "public"."estado_usuario" AS ENUM('pendiente_kyc', 'activo', 'baneado');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('propietario', 'principal', 'externo', 'admin');--> statement-breakpoint
CREATE TABLE "alias" (
	"alias" text PRIMARY KEY NOT NULL,
	"usuario_id" uuid,
	"avatar_id" smallint NOT NULL,
	"asignado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"retirado" boolean DEFAULT false NOT NULL,
	"retirado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auditoria_reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserva_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"estado_anterior" "estado_reserva",
	"estado_nuevo" "estado_reserva" NOT NULL,
	"detalle" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendario_dias" (
	"propiedad_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"estado" "estado_dia" DEFAULT 'disponible' NOT NULL,
	"reserva_id" uuid,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracion_plataforma" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserva_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"pdf_url" text NOT NULL,
	"hash_sha256" text NOT NULL,
	"generado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contratos_reserva_id_unique" UNIQUE("reserva_id")
);
--> statement-breakpoint
CREATE TABLE "cuentas_bancarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"banco" text NOT NULL,
	"numero_cifrado" text NOT NULL,
	"certificada" boolean DEFAULT false NOT NULL,
	"validada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "eventos_pasarela" (
	"pasarela_ref" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"payload" jsonb NOT NULL,
	"procesado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos_reputacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"tipo" text NOT NULL,
	"valor" integer NOT NULL,
	"reserva_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intentos_fuga" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"evidencia" jsonb NOT NULL,
	"accion" text NOT NULL,
	"registrado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links_de_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserva_id" uuid NOT NULL,
	"mitad" smallint NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"url" text NOT NULL,
	"pasarela_link_ref" text,
	"estado" "estado_link" DEFAULT 'activo' NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_de_pago_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "lista_negra_identidad" (
	"cedula_hash" text PRIMARY KEY NOT NULL,
	"biometria_proveedor_id" text,
	"motivo" text NOT NULL,
	"evidencia" jsonb,
	"baneado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensajes_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserva_id" uuid,
	"solicitud_id" uuid,
	"emisor_id" uuid NOT NULL,
	"contenido" text NOT NULL,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ocr_estado" text,
	"enviado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negociaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"estado" text DEFAULT 'abierta' NOT NULL,
	"precio_acordado_centavos" bigint,
	"tarifa_neta_centavos" bigint NOT NULL,
	CONSTRAINT "negociaciones_solicitud_id_unique" UNIQUE("solicitud_id")
);
--> statement-breakpoint
CREATE TABLE "ofertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negociacion_id" uuid NOT NULL,
	"emisor_id" uuid NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"estado" "estado_oferta" DEFAULT 'activa' NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propiedades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propietario_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"municipio" text NOT NULL,
	"zona" text NOT NULL,
	"tipo" text NOT NULL,
	"capacidad" smallint NOT NULL,
	"habitaciones" smallint NOT NULL,
	"banos" smallint NOT NULL,
	"amenidades" text[] DEFAULT '{}' NOT NULL,
	"reglas" text[] DEFAULT '{}' NOT NULL,
	"cert_tradicion_libertad_url" text,
	"verificada" boolean DEFAULT false NOT NULL,
	"publicada" boolean DEFAULT false NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"externo_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"estado" "estado_reserva" DEFAULT 'PRECIO_ACORDADO' NOT NULL,
	"precio_final_centavos" bigint NOT NULL,
	"tarifa_neta_centavos" bigint NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "sincronizaciones_ical" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"url" text NOT NULL,
	"direccion" text NOT NULL,
	"ultima_sync" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "solicitudes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"externo_id" uuid NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"huespedes" smallint NOT NULL,
	"estado" "estado_solicitud" DEFAULT 'pendiente' NOT NULL,
	"principal_aceptante_id" uuid,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"vence_en" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaccion_id" uuid NOT NULL,
	"beneficiario_id" uuid,
	"concepto" text NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"dispersado" boolean DEFAULT false NOT NULL,
	"pasarela_payout_ref" text,
	"dispersado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suscripciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propietario_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"estado" text NOT NULL,
	"renueva_en" date NOT NULL,
	"pasarela_sub_ref" text
);
--> statement-breakpoint
CREATE TABLE "tarifas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"neta_noche_centavos" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transacciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"pasarela_ref" text NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"estado" text NOT NULL,
	"webhook_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transacciones_pasarela_ref_unique" UNIQUE("pasarela_ref")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"nombre_real" text NOT NULL,
	"cedula_hash" text NOT NULL,
	"cedula_cifrada" text NOT NULL,
	"email" text NOT NULL,
	"telefono_cifrado" text NOT NULL,
	"rol" "rol"[] NOT NULL,
	"estado" "estado_usuario" DEFAULT 'pendiente_kyc' NOT NULL,
	"kyc_proveedor_id" text,
	"kyc_verificado_en" timestamp with time zone,
	CONSTRAINT "usuarios_cedula_hash_unique" UNIQUE("cedula_hash"),
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vinculos_comisionista" (
	"propiedad_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"estado" text DEFAULT 'activo' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alias" ADD CONSTRAINT "alias_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_reservas" ADD CONSTRAINT "auditoria_reservas_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendario_dias" ADD CONSTRAINT "calendario_dias_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_reputacion" ADD CONSTRAINT "eventos_reputacion_alias_alias_alias_fk" FOREIGN KEY ("alias") REFERENCES "public"."alias"("alias") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_reputacion" ADD CONSTRAINT "eventos_reputacion_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intentos_fuga" ADD CONSTRAINT "intentos_fuga_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links_de_pago" ADD CONSTRAINT "links_de_pago_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes_chat" ADD CONSTRAINT "mensajes_chat_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes_chat" ADD CONSTRAINT "mensajes_chat_solicitud_id_solicitudes_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes_chat" ADD CONSTRAINT "mensajes_chat_emisor_id_usuarios_id_fk" FOREIGN KEY ("emisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negociaciones" ADD CONSTRAINT "negociaciones_solicitud_id_solicitudes_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_negociacion_id_negociaciones_id_fk" FOREIGN KEY ("negociacion_id") REFERENCES "public"."negociaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_emisor_id_usuarios_id_fk" FOREIGN KEY ("emisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_propietario_id_usuarios_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_solicitud_id_solicitudes_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_principal_id_usuarios_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_externo_id_usuarios_id_fk" FOREIGN KEY ("externo_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sincronizaciones_ical" ADD CONSTRAINT "sincronizaciones_ical_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_externo_id_usuarios_id_fk" FOREIGN KEY ("externo_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_principal_aceptante_id_usuarios_id_fk" FOREIGN KEY ("principal_aceptante_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splits" ADD CONSTRAINT "splits_transaccion_id_transacciones_id_fk" FOREIGN KEY ("transaccion_id") REFERENCES "public"."transacciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splits" ADD CONSTRAINT "splits_beneficiario_id_usuarios_id_fk" FOREIGN KEY ("beneficiario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_propietario_id_usuarios_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_link_id_links_de_pago_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links_de_pago"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos_comisionista" ADD CONSTRAINT "vinculos_comisionista_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos_comisionista" ADD CONSTRAINT "vinculos_comisionista_principal_id_usuarios_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alias_un_activo_por_usuario" ON "alias" USING btree ("usuario_id") WHERE NOT retirado;--> statement-breakpoint
CREATE INDEX "auditoria_por_reserva" ON "auditoria_reservas" USING btree ("reserva_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendario_pk" ON "calendario_dias" USING btree ("propiedad_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "link_por_mitad" ON "links_de_pago" USING btree ("reserva_id","mitad");--> statement-breakpoint
CREATE INDEX "chat_por_reserva" ON "mensajes_chat" USING btree ("reserva_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vinculo_unico" ON "vinculos_comisionista" USING btree ("propiedad_id","principal_id");