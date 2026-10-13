import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db";
import { notificaciones, propiedades, reservas, usuarios } from "../db/schema";
import { obtenerEmail } from "../adaptadores/email";
import { formatear, centavos, liquidarReserva } from "@/lib/dinero";

/**
 * Notificaciones por evento del negocio. Canal email por adaptador (simulado →
 * bandeja /admin/dev · Resend al pegar la llave). Push: mismo patrón, Fase
 * siguiente de OneSignal usa este mismo despachador.
 */
export type EventoNotificable =
  | "solicitud_entrante"
  | "oferta_recibida"
  | "pago_confirmado"
  | "recordatorio_saldo"
  | "link_por_expirar";

const PLANTILLAS: Record<EventoNotificable, (d: Record<string, string>) => { asunto: string; cuerpo: string }> = {
  solicitud_entrante: (d) => ({
    asunto: "Nueva solicitud de renta — el primero que acepta gana",
    cuerpo: `${d.alias} solicita ${d.propiedad} (${d.fechas}). Corre: la solicitud vence pronto.`,
  }),
  oferta_recibida: (d) => ({
    asunto: "Tienes una oferta en tu negociación",
    cuerpo: `${d.alias} propone ${d.monto} por ${d.propiedad}. Revisa el desglose en vivo y responde antes de que venza.`,
  }),
  pago_confirmado: (d) => ({
    asunto: `Pago confirmado ✓ — ${d.codigo}`,
    cuerpo: `Entró el pago ${d.mitad} de ${d.propiedad} por ${d.monto}. El split ya se dispersó automáticamente.`,
  }),
  recordatorio_saldo: (d) => ({
    asunto: "El saldo de tu reserva vence pronto",
    cuerpo: `El link del 50% restante de ${d.propiedad} (check-in ${d.fechas}) vence ${d.vence}. Reenvíalo a tu cliente.`,
  }),
  link_por_expirar: (d) => ({
    asunto: "Tu link de pago está por expirar",
    cuerpo: `El link de ${d.propiedad} por ${d.monto} expira ${d.vence}. Sin pago, las fechas siguen libres para otros.`,
  }),
};

export async function notificar(
  db: Db,
  evento: EventoNotificable,
  destinatarioEmail: string,
  datos: Record<string, string>,
): Promise<void> {
  const { asunto, cuerpo } = PLANTILLAS[evento](datos);
  await obtenerEmail().enviar(db, destinatarioEmail, asunto, cuerpo);
}

/**
 * Notificación IN-APP (la campanita). Falla en silencio: una notificación
 * jamás debe tumbar la operación que la origina.
 */
export async function notificarEnApp(
  db: Db,
  usuarioId: string,
  n: { tipo: string; titulo: string; cuerpo: string; url?: string },
): Promise<void> {
  try {
    await db.insert(notificaciones).values({
      usuarioId,
      tipo: n.tipo,
      titulo: n.titulo,
      cuerpo: n.cuerpo,
      url: n.url ?? null,
    });
  } catch (e) {
    console.error("[notificaciones] in-app falló:", e);
  }
}

/**
 * Notifica a las 3 partes internas cuando entra un pago. Una sola consulta
 * (reserva + propiedad + emails por JOIN), correos en paralelo con
 * Promise.allSettled (uno caído no frena a los demás) y la campanita de las
 * 3 partes en UN insert multi-fila.
 */
export async function notificarPagoConfirmado(db: Db, reservaId: string, mitad: number): Promise<void> {
  const dueno = alias(usuarios, "dueno");
  const principal = alias(usuarios, "principal");
  const externo = alias(usuarios, "externo");
  const [r] = await db
    .select({
      codigo: reservas.codigo,
      precioFinalCentavos: reservas.precioFinalCentavos,
      tarifaNetaCentavos: reservas.tarifaNetaCentavos,
      principalId: reservas.principalId,
      externoId: reservas.externoId,
      propiedad: propiedades.nombre,
      propietarioId: propiedades.propietarioId,
      emailDueno: dueno.email,
      emailPrincipal: principal.email,
      emailExterno: externo.email,
    })
    .from(reservas)
    .innerJoin(propiedades, eq(propiedades.id, reservas.propiedadId))
    .leftJoin(dueno, eq(dueno.id, propiedades.propietarioId))
    .leftJoin(principal, eq(principal.id, reservas.principalId))
    .leftJoin(externo, eq(externo.id, reservas.externoId))
    .where(eq(reservas.id, reservaId));
  if (!r) return;

  // Monto EXACTO de la mitad (el saldo lleva el resto), no floor(/2).
  const liq = liquidarReserva(centavos(r.precioFinalCentavos), centavos(r.tarifaNetaCentavos));
  const datos = {
    codigo: r.codigo,
    propiedad: r.propiedad,
    mitad: mitad === 1 ? "1 de 2 (anticipo)" : "2 de 2 (saldo)",
    monto: formatear(liq.mitades[mitad === 1 ? 0 : 1].montoCliente),
  };
  const correos = [r.emailDueno, r.emailPrincipal, r.emailExterno].filter((e): e is string => !!e);
  const envios = await Promise.allSettled(correos.map((email) => notificar(db, "pago_confirmado", email, datos)));
  for (const e of envios) {
    if (e.status === "rejected") console.error("[notificaciones] email de pago falló:", e.reason);
  }

  // Campanita para las 3 partes (un solo insert).
  const titulo = `Pago ${datos.mitad} confirmado ✓`;
  const cuerpo = `${r.propiedad} · ${r.codigo} · ${datos.monto}. Split registrado a cada cuenta certificada.`;
  try {
    await db.insert(notificaciones).values([
      { usuarioId: r.propietarioId, tipo: "pago", titulo, cuerpo, url: "/app/propietario" },
      { usuarioId: r.principalId, tipo: "pago", titulo, cuerpo, url: "/app/principal" },
      { usuarioId: r.externoId, tipo: "pago", titulo, cuerpo, url: "/app/externo/links" },
    ]);
  } catch (e) {
    console.error("[notificaciones] in-app falló:", e);
  }
}
