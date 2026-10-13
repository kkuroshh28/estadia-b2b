-- Índices para uso masivo (auditoría de escalabilidad 2026-10-13).
-- Parciales donde el cron/panel filtra siempre por un estado.
CREATE INDEX IF NOT EXISTS "propiedades_por_propietario" ON "propiedades" ("propietario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "propiedades_publicadas" ON "propiedades" ("creada_en", "id") WHERE "publicada";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ofertas_por_negociacion" ON "ofertas" ("negociacion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ofertas_activas_vencen" ON "ofertas" ("vence_en") WHERE "estado" = 'activa';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "solicitudes_por_aceptante" ON "solicitudes" ("principal_aceptante_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "solicitudes_pendientes_vencen" ON "solicitudes" ("vence_en") WHERE "estado" = 'pendiente';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "negociaciones_por_estado" ON "negociaciones" ("estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "links_activos_vencen" ON "links_de_pago" ("vence_en") WHERE "estado" = 'activo';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservas_en_checkin" ON "reservas" ("hasta") WHERE "estado" = 'CHECK_IN';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otps_por_email" ON "otps" ("email", "creado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otps_vencidos" ON "otps" ("vence_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sesiones_por_usuario" ON "sesiones" ("usuario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sesiones_vencidas" ON "sesiones" ("vence_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notificaciones_recientes" ON "notificaciones" ("usuario_id", "creada_en" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_por_solicitud_fecha" ON "mensajes_chat" ("solicitud_id", "enviado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suscripciones_por_propietario" ON "suscripciones" ("propietario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reputacion_por_alias" ON "eventos_reputacion" ("alias");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ical_por_propiedad" ON "sincronizaciones_ical" ("propiedad_id", "direccion");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ical_por_ultima_sync" ON "sincronizaciones_ical" ("ultima_sync" NULLS FIRST);
