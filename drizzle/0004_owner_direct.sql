ALTER TABLE "propiedades" ADD COLUMN "owner_direct" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "margen_minimo_centavos" bigint DEFAULT 0 NOT NULL;