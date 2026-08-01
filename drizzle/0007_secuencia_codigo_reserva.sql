-- El código de reserva se numeraba con count(*): dos aceptaciones simultáneas
-- obtenían el mismo número → colisión 23505 y venta caída. Secuencia atómica:
-- nextval jamás repite, ni bajo concurrencia.
CREATE SEQUENCE IF NOT EXISTS reservas_codigo_seq;
SELECT setval(
  'reservas_codigo_seq',
  GREATEST(
    400,
    COALESCE((SELECT MAX((substring(codigo from '\d{5}$'))::int) FROM reservas), 400)
  )
);
