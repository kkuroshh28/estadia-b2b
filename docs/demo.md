# Modo demo — cómo mostrar ESTADÍA sin tocar datos reales

## Demo pública (sin instalación)
- **https://estadia-b2b.vercel.app** — landing y demo navegable completa.
- La app demo no exige login: el sidebar permite recorrer los TRES roles
  (un usuario real solo vería el suyo). Guion sugerido para propietarios e
  inversionistas:
  1. Landing → visualización del flujo del dinero (el pitch en 10 segundos).
  2. `/app/propietario/calendario` → calculadora de neto + bloqueo por arrastre.
  3. `/app/principal` → esperar 6 s: entra una solicitud en vivo → aceptar.
  4. `/app/negociacion` → mover el slider (desglose en vivo) → aceptar → link.
  5. `/pago/lnk-7f3a` → pagar (simulado) → split animado.
  6. `/app/chat` → escribir "mi número es 310..." → bloqueo anti-fuga en vivo
     (validado en el SERVIDOR de verdad) → 3 intentos → ban.
  7. `/registro` → revelación del alias.

## Demo con datos en base de datos real (cuando haya DB)
```bash
DATABASE_URL=... npm run db:migrate
DATABASE_URL=... npm run db:seed
```
El seed crea: 3 propietarios, 8 comisionistas con alias reales (servicio de
unicidad), 12 propiedades (Guatapé, El Peñol, San Jerónimo, Santa Fe, El
Poblado, Laureles, Rionegro, El Retiro, Jardín) con tarifas en COP y calendarios
con ocupación variada, suscripciones activas, **una reserva pagada procesada por
el motor real** (webhook + splits exactos + auditoría) y una negociación en
curso con oferta/contraoferta. Idempotente: correrlo dos veces no duplica.

### Cuentas demo (cuando el auth real esté activo)
Se crearán en el seed con esta convención (hoy son filas de usuario sin login):
- `demo.propietario1@estadia.demo` — rol propietario
- `demo.principal1@estadia.demo` — rol principal (alias asignado por el sistema)
- `demo.externo1@estadia.demo` — rol externo (alias asignado por el sistema)
- Admin: se crea al construir el panel /admin (Fase 5), con 2FA obligatorio.

## Correr todo local
```bash
npm install
docker run -d --name estadia-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=estadia_test -p 5544:5432 postgres:16-alpine
DATABASE_URL=postgres://postgres:test@localhost:5544/estadia_test npm run db:migrate
DATABASE_URL=postgres://postgres:test@localhost:5544/estadia_test npm test   # 55 tests
npm run dev
```
