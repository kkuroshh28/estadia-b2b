-- Huéspedes adicionales: la tarifa base cubre hasta N huéspedes; por encima
-- se cobra una tarifa POR PERSONA POR NOCHE que es del propietario (se suma
-- a la tarifa neta antes de negociar la comisión).
ALTER TABLE "propiedades" ADD COLUMN IF NOT EXISTS "huespedes_incluidos" smallint;
ALTER TABLE "propiedades" ADD COLUMN IF NOT EXISTS "tarifa_adicional_centavos" bigint NOT NULL DEFAULT 0;

ALTER TABLE "propiedades" DROP CONSTRAINT IF EXISTS "propiedades_adicionales_coherentes";
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_adicionales_coherentes"
  CHECK (
    "tarifa_adicional_centavos" >= 0
    AND ("huespedes_incluidos" IS NULL OR ("huespedes_incluidos" >= 1 AND "huespedes_incluidos" <= "capacidad"))
  );
