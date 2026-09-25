-- Ficha comercial + fotos/videos de propiedad (0008 compensaciones ya existía a mano; el snapshot la incorpora aquí).
ALTER TABLE "propiedades" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "departamento" text;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "ubicacion_publica" text;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "resumen" text;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "descripcion" text;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "nota" text;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "datos_clave" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "secciones" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "fotos" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "videos" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_slug_unique" UNIQUE("slug");
