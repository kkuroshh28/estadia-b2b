ALTER TABLE "usuarios" ADD COLUMN "intentos_fallidos" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "bloqueado_hasta" timestamp with time zone;