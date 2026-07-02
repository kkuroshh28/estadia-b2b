# Decisión de pasarela — Wompi vs. MercadoPago Marketplace

**Estado: Wompi implementado como driver primario (links + eventos + reembolsos).
La dispersión multi-beneficiario queda EXPLÍCITAMENTE sin improvisar hasta
validarla en sandbox real.**

## Lo que exige el modelo (no negociable)
1. Links de pago de un solo uso con monto exacto en centavos COP.
2. Webhooks firmados en tiempo real (única fuente de verdad).
3. **Dispersión directa a N beneficiarios por transacción** (propietario,
   principal, externo, plataforma) SIN que el dinero pase por cuentas propias
   (riesgo de captación — Superintendencia Financiera).
4. Reembolsos parciales/totales por API.

## Wompi (driver `wompi` — implementado)
- ✅ Links de pago nativos (`/v1/payment_links`), montos en centavos.
- ✅ Eventos firmados (checksum SHA-256 documentado) — implementado y verificable.
- ✅ Reembolsos por API.
- ⚠️ **Dispersión:** Wompi tiene producto de payouts/dispersión, pero su
  disponibilidad depende del contrato del comercio. `dispersar()` del driver
  LANZA error con mensaje claro hasta que se valide con la cuenta sandbox.
  Ventaja: es Bancolombia — donde bancarizan los comisionistas del gremio.

## MercadoPago Marketplace (alternativa evaluada)
- ✅ Split nativo en el momento del pago (`marketplace_fee` + collectors), diseñado
  exactamente para este caso multi-beneficiario.
- ✅ Webhooks firmados, links (preferences), reembolsos.
- ➖ Comisiones típicamente mayores que Wompi en COP; experiencia de checkout
  menos "bancaria" para pagadores colombianos.
- El driver comparte la MISMA interfaz `PasarelaPagos`: implementarlo es un
  archivo nuevo, cero cambios en el motor de dinero.

## Recomendación
1. Validar payouts de Wompi con la cuenta sandbox (1 día de trabajo con llaves).
2. Si Wompi NO habilita dispersión a terceros para el comercio → implementar
   driver `mercadopago` (interfaz ya definida) y usar Wompi solo si algún día
   habilita el producto. La decisión es reversible por diseño (flag de entorno).
