# Runbook de incidentes — ESTADÍA

Principio: **ante la duda, detener el dinero, jamás improvisar.** Todo lo de
abajo deja rastro en `auditoria_reservas`, `eventos_pasarela` y `splits`.

## 1. Falló un webhook de pago
- Los webhooks son la ÚNICA fuente de verdad; la pasarela reintenta sola.
- Si Wompi marca entregas fallidas: revisar logs del endpoint y `eventos_pasarela`
  (¿llegó y falló al procesar, o nunca llegó?).
- Reprocesar es SEGURO: la idempotencia por `pasarela_ref` garantiza que un
  evento repetido es no-op (test: "jamás duplica un split"). Se puede re-enviar
  el evento desde el dashboard de la pasarela sin miedo.
- Si el link quedó `pagado` pero la reserva no transicionó: correr
  `transicionPostPago(db, reservaId, mitad)` — validará la máquina de estados.

## 2. Un split no dispersó
- `SELECT * FROM splits WHERE dispersado = false AND ...` — identificar payout.
- Verificar el estado del payout en la pasarela con `pasarela_payout_ref`.
- NUNCA re-dispersar a mano sin confirmar en la pasarela que el payout anterior
  murió; registrar la orden nueva con referencia nueva.
- Si la cuenta bancaria del beneficiario es inválida: marcar la cuenta
  `certificada=false`, notificar al usuario, y dejar el split pendiente (el
  dinero está en la pasarela, no se pierde).

## 3. La pasarela cae
- Los links activos mostrarán error de la pasarela en checkout; NO generar
  flujos alternativos de cobro (regla #9: no existe pago fuera de link).
- Las vigencias de links se pausan por decisión de admin (extender `vence_en`)
  para no expirar clientes por una caída ajena.
- Al volver: los webhooks encolados llegan; la idempotencia absorbe duplicados.

## 4. Ejecutar un reembolso
- Solo admin, con doble confirmación (cuando exista el panel; hoy: manual).
- Orden: (1) reembolso en la pasarela → (2) marcar transacción `reversada` →
  (3) los splits asociados se compensan con contra-splits (montos negativos,
  mismo concepto) para que la conciliación siga cuadrando al centavo →
  (4) transición de reserva a CANCELADA con auditoría.
- El caso "perdedor de la carrera alcanzó a autorizar cobro": mismo flujo,
  disparado automáticamente al detectar `INVALIDADA` con transacción aprobada.

## 5. Ejecutar / revertir un ban manual
- Ejecutar: usar la misma ruta del automático — insertar en
  `lista_negra_identidad` (hash cédula + id biométrico), `usuarios.estado='baneado'`,
  `retirarAlias()` para cada alias. Sesiones se invalidan al tener auth real.
- Revertir (solo error administrativo comprobado): borrar la fila de
  `lista_negra_identidad` + `estado='activo'`. **El alias NO vuelve**: los alias
  retirados jamás se reasignan; el usuario recibe alias nuevo. Documentar el
  motivo en `intentos_fuga` (accion='reversion_admin').

## 6. La conciliación diaria no cuadra
- Alerta = parar dispersiones pendientes primero.
- Comparar `SUM(transacciones aprobadas)` vs `SUM(splits)` por transacción:
  el invariante por-transacción es exacto por diseño; una diferencia solo puede
  venir de (a) fee real de pasarela ≠ estimado (ajustar el asiento de fee),
  (b) reembolso sin contra-split (aplicar §4.3), (c) bug — congelar y auditar.

## 7. Base de datos caída / migración fallida
- Migraciones SOLO con `npm run db:migrate` (drizzle) — jamás SQL a mano en prod.
- Toda migración corre primero en staging (CI la aplica al Postgres de servicio
  en cada push; el deploy a prod es manual).
