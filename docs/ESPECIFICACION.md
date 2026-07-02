# Especificación de Producto — Marketplace B2B de Rentas Cortas
**Antioquia, Colombia · Versión 1.1 — Documento base para desarrollo**

Plataforma B2B que conecta propietarios de inmuebles de renta corta con su red de
comisionistas. El cliente final (huésped) nunca usa la app; solo interactúa con un
link de pago.

## 1. Principios no negociables

1. 100% B2B. Solo tres roles: Propietario, Comisionista Principal, Comisionista Externo. El cliente final nunca entra ni ve el inventario.
2. Rentas cortas únicamente: 1 noche a máximo 3 meses.
3. Todo pago con tarjeta, por link, a través de la app. Efectivo prohibido.
4. El calendario solo se bloquea con dinero. Sin holds ni reservas tentativas. El primero que paga, gana.
5. Pago en dos mitades: 50% para reservar, 50% el día de ingreso, ambas por link.
6. Cada mitad se reparte automáticamente al entrar, sin retenciones.
7. El propietario siempre recibe su tarifa neta completa (menos ~3% de pasarela, informado desde antes). La comisión va por encima.
8. El precio final se negocia en el módulo formal de negociación entre Principal y Externo. Comisión = precio acordado − tarifa neta.
9. Toda comunicación es interna. Intercambio de datos de contacto = ban perpetuo, inmediato, aplicado a la identidad (cédula + biometría).
10. Identidad verificada, operación anónima: KYC real + alias autogenerado único e irrepetible.
11. Solo el propietario controla el calendario de su propiedad (incluye bloqueo manual).

## 2. Roles

**Propietario**: paga suscripción para publicar; fija tarifa neta intocable; único con escritura en calendario; vincula 3–5 principales por invitación; cuenta bancaria certificada; asume 100% pasarela (~3%) con calculadora de neto.

**C. Principal**: vinculado por invitación; recibe solicitudes (el primero en aceptar gana); negocia precio final; recibe 50% de la comisión; alias anónimo; reputación: velocidad de respuesta, tasa de aceptación, reservas completadas.

**C. Externo**: trae el cliente (es SUYO, la app jamás lo contacta); filtra por fechas/zona/capacidad/precio → solo disponibilidad real con tarifa neta visible; envía solicitudes y negocia; reenvía links de pago; recibe 40%; reputación: tasa de pago de links, reservas, cancelaciones.

**La app**: 10% de la comisión de cada mitad + suscripciones. No asume pasarela. (Airbnb cobra 14–16% anfitrión + ~14% huésped.)

## 3. Identidad y anonimato

- KYC obligatorio: nombre, cédula, biometría (Truora/Mati), teléfono, email, cuenta bancaria certificada. Propietarios: certificado de tradición y libertad → sello "Propiedad Verificada".
- Alias: autogenerado al registrarse, aleatorio, único global, irrepetible (baneado nunca se reutiliza), no elegible/editable/transferible. Avatar genérico; fotos reales prohibidas. Reputación pegada al alias.
- Identidad real vive SOLO en: backend (KYC, fraude, dispersión), contratos legales (con nombres reales, entrega restringida) y obligaciones tributarias (DIAN).
- El anonimato protege donde ocurre la fuga: la relación Externo ↔ Principal.

## 4. Modelo de dinero

- Tarifa neta la fija el propietario; intocable.
- Precio final acordado en módulo de negociación (oferta → contraoferta → aceptación) con desglose en vivo para ambos ("si cierras en $X, tú ganas $A y él gana $B"), vigencias por propuesta, registro inmutable, precio aceptado genera el link automáticamente. Precio sugerido con datos de mercado.
- Comisión = precio final − tarifa neta. Split 50/40/10.
- Piso de comisión: SIN piso al lanzamiento; lógica programada desde el MVP tras switch de configuración.
- Ejemplo: neta $1.000.000, acuerdo $1.200.000 → comisión $200.000 (P $100k / E $80k / App $20k); pasarela ~3% de $1.2M = $36.000 → propietario neto $964.000.
- Calculadora de neto en tiempo real al fijar tarifa.
- Pasarelas candidatas (split nativo + links): Wompi, MercadoPago Marketplace, PayU. El dinero nunca pasa por cuentas propias (Superfinanciera). Validar con abogado.
- Cancelaciones: anticipo ya repartido; ventanas y compensaciones por definir con abogado.

## 5. Máquina de estados

SOLICITADA → ACEPTADA → NEGOCIACIÓN → PRECIO_ACORDADO → LINK_1_ENVIADO →
ANTICIPO_PAGADO (bloqueo calendario + Split 1) → SALDO_LINK_ENVIADO →
PAGO_COMPLETO (Split 2 + semáforo ✓) → CHECK_IN → COMPLETADA.
Terminales: EXPIRADA, INVALIDADA (otro pagó primero), RECHAZADA, CANCELADA.

- Sin holds; links competidores en paralelo; primer webhook gana, el otro link se invalida al instante ("Fechas ya no disponibles", tarjeta no cobrada).
- Link del Pago 2 se genera 24–48 h antes del check-in con recordatorios.
- Sin "Pago completo ✓" no hay entrega.

## 6. Calendario

Fuente única de verdad. Días ocupados inseleccionables. Bloqueo automático al Pago 1; manual solo propietario. iCal bidireccional Airbnb/Booking = requisito de entrada.

## 7. Anti-fuga

Filtro NLP en tiempo real pre-envío (números — también en palabras —, correos, usuarios, URLs), OCR en imágenes, registro de intentos. Ban a la identidad: cédula + biometría en lista negra, alias retirado para siempre. Defensa estructural: anonimato + conveniencia.

## 8–10. Pantallas, datos y arquitectura

Ver README (pantallas), `supabase/schema.sql` (modelo de datos §9) y lineamientos:
apps móviles + checkout web; backend + PostgreSQL transaccional (locks de fila);
webhooks idempotentes como única confirmación de pago; push; servicio anti-fuga;
servicio de alias; contratos PDF por duración; auditoría inmutable.

## 11. Marco legal (validar con abogados)

Split directo vía pasarela (no captación de terceros); retención, 4×1000, factura DIAN sobre comisión de la app. <30 días = vivienda turística (RNT); 1–3 meses = zona gris Ley 820. Contratos con identidades reales sin romper anonimato operativo. Habeas data Ley 1581 (biometría, lista negra en T&C).

## 13. Decisiones pendientes

Precio de suscripción; vigencias exactas; política de cancelación; pasarela definitiva; criterio de activación del piso; zona del piloto (recomendado Oriente Antioqueño / Guatapé–El Peñol, 30–50 propiedades).

## 14. Roadmap

- **Fase 0**: legal + pasarela + T&C + contratos automáticos.
- **Fase 1 MVP**: KYC 3 roles + alias, propiedades y tarifa neta, calendario con bloqueo manual, búsqueda, solicitudes, negociación, links 50/50 con split, chat con filtro, semáforo, piso programado (apagado).
- **Fase 2**: iCal, reputación, OCR, precio sugerido, reportes.
- **Fase 3**: expansión (Antioquia → Eje Cafetero → Costa), activación del piso.
