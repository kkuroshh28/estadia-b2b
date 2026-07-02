# ESTADÍA — Marketplace B2B de Rentas Cortas · Antioquia

Plataforma **100% B2B** que conecta propietarios de inmuebles de renta corta con su
red de comisionistas. El cliente final (huésped) **nunca usa la app**: solo recibe
un link de pago.

> **El calendario solo se bloquea con dinero, nunca con promesas.
> El primero que paga, gana.**

## Reglas de negocio cerradas (resumen)

| # | Regla |
|---|-------|
| 1 | Solo B2B: tres roles — Propietario, Comisionista Principal, Comisionista Externo |
| 2 | Rentas de 1 noche a máximo 3 meses |
| 3 | Propietarios pagan suscripción para publicar |
| 4 | 3–5 principales por propiedad, por invitación |
| 5 | El propietario fija su **tarifa neta** y siempre la recibe completa; la comisión va por encima |
| 6 | El precio final lo negocian Principal y Externo en el **módulo formal de ofertas** |
| 7 | Comisión = precio acordado − tarifa neta · split **50% / 40% / 10%** |
| 8 | Sin piso de comisión al lanzamiento; piso configurable ya programado (apagado) |
| 9 | Pago 50% para reservar + 50% al ingreso, siempre tarjeta por link. Efectivo prohibido |
| 10 | **Sin holds**: el calendario solo se bloquea al confirmar el Pago 1 por webhook |
| 11 | Cada mitad se dispersa automáticamente, sin retenciones |
| 12 | El ~3% de pasarela lo asume solo el propietario (calculadora de neto) |
| 13 | Sin "Pago completo ✓" no hay entrega |
| 14 | Solo el propietario edita el calendario |
| 15 | Sincronización iCal con Airbnb/Booking obligatoria |
| 16 | Toda comunicación es interna · intercambio de contactos = **ban perpetuo a la identidad** |
| 17 | Alias anónimos autogenerados, únicos e irrepetibles; identidad real solo en backend/contratos |

## Qué hay en este repo

**Demo de producto navegable** (Next.js 16 · App Router · Tailwind v4 · TypeScript ·
Framer Motion · Recharts) con la lógica de negocio real como capa de dominio pura y
testeable. Sistema de diseño "fintech de gremio inmobiliario": carbón azulado,
esmeralda financiera (dinero/confirmado), ámbar (pendiente/negociación), mono
tabular para cifras, y la visualización de firma del **flujo del dinero**.

```
src/lib/domain/
  tipos.ts      Entidades del dominio
  split.ts      Split 50/40/10, pasarela 3%, piso de comisión (switch), calculadora de neto
  reserva.ts    Máquina de estados completa (§5) + reglas de bloqueo/entrega
  alias.ts      Generador de alias anónimos (CONDOR-472…)
  antifuga.ts   Filtro anti-fuga pre-envío (teléfonos, correos, redes, números en palabras)
src/lib/data/demo.ts   Datos de demostración (piloto Oriente Antioqueño)
supabase/schema.sql    Schema PostgreSQL completo de referencia (NO aplicado aún)
```

### Pantallas

| Ruta | Qué muestra |
|------|-------------|
| `/` | Landing pública: principios, modelo de dinero con ejemplo real, flujo, anti-fuga |
| `/app` | Hub de roles (en producción cada usuario ve solo el suyo) |
| `/app/propietario` | Panel: propiedades, tarifa neta, semáforo de pagos por reserva |
| `/app/propietario/calendario` | Calendario editable (bloqueo manual) + calculadora de neto en vivo |
| `/app/principal` | Bandeja de solicitudes en tiempo real ("el primero que acepta gana") |
| `/app/negociacion` | **Módulo de negociación**: oferta→contraoferta→aceptación con desglose en vivo |
| `/app/externo` | Búsqueda con disponibilidad real y tarifa neta visible |
| `/app/externo/links` | Links de pago con estados (activo/pagado/invalidado) |
| `/pago/[linkId]` | Checkout del cliente final — pago simulado, confirmación animada, estados de link |
| `/registro` | Onboarding con KYC simulado y **revelación del alias** |
| `/app/chat` | Chat interno entre alias con filtro anti-fuga EN VIVO (strikes → ban) |
| `/app/principal/comisiones` · `/app/externo/comisiones` | Historial de splits + gráfica mensual |
| `/app/externo/propiedad/[id]` | Ficha técnica + selector de fechas (días ocupados inseleccionables) |
| `/app/propietario/principales` | Gestión de los 3–5 principales por propiedad |

## Correr local

```bash
npm install
npm run dev   # http://localhost:3000
```

## Estado y siguientes fases

Esto es la **Fase de producto/demo**. Pendiente (según spec §13–14):

- **Fase 0**: estructura jurídica, contrato con pasarela de splits (Wompi vs. MercadoPago vs. PayU), T&C con política de ban, validación anonimato vs. contratos.
- **Fase 1 (MVP real)**: backend propio (el `schema.sql` ya modela todo), KYC (Truora/Mati), links de pago reales con webhook + split, chat con filtro anti-fuga.
- **Fase 2**: iCal bidireccional, reputación por alias, OCR en chat, precio sugerido por datos.
- Decisiones abiertas: precio de suscripción, vigencias exactas, política de cancelación, pasarela definitiva, zona de piloto.

> ⚠️ Este repositorio es un proyecto **aislado**: no comparte código, base de datos
> ni recursos con ningún otro proyecto.

---
Antioquia, Colombia · Demo de producto — no constituye asesoría legal.
