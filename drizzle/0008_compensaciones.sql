-- Cobros aprobados que no pudieron aplicarse (link vencido/invalidado o
-- carrera perdida): dinero del cliente pendiente de devolver, registrado en
-- la MISMA transacción del evento del webhook.
CREATE TABLE IF NOT EXISTS "compensaciones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pasarela_ref" text NOT NULL UNIQUE,
  "link_id" uuid REFERENCES "links_de_pago"("id"),
  "reserva_id" uuid REFERENCES "reservas"("id"),
  "monto_centavos" bigint NOT NULL,
  "motivo" text NOT NULL,
  "estado" text NOT NULL DEFAULT 'pendiente',
  "creada_en" timestamptz NOT NULL DEFAULT now(),
  "resuelta_en" timestamptz
);
CREATE INDEX IF NOT EXISTS "compensaciones_pendientes" ON "compensaciones" ("estado");
