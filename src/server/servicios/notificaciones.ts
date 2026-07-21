import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { notificaciones, propiedades, reservas, usuarios } from "../db/schema";
import { obtenerEmail } from "../adaptadores/email";
import { formatear, centavos } from "@/lib/dinero";

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

/** Notifica a las 3 partes internas cuando entra un pago. */
export async function notificarPagoConfirmado(db: Db, reservaId: string, mitad: number): Promise<void> {
  const [r] = await db.select().from(reservas).where(eq(reservas.id, reservaId));
  if (!r) return;
  const [prop] = await db.select().from(propiedades).where(eq(propiedades.id, r.propiedadId));
  const partes = await db
    .select({ email: usuarios.email })
    .from(usuarios)
    .where(eq(usuarios.id, prop.propietarioId));
  const [principal] = await db.select({ email: usuarios.email }).from(usuarios).where(eq(usuarios.id, r.principalId));
  const [externo] = await db.select({ email: usuarios.email }).from(usuarios).where(eq(usuarios.id, r.externoId));

  const datos = {
    codigo: r.codigo,
    propiedad: prop.nombre,
    mitad: mitad === 1 ? "1 de 2 (anticipo)" : "2 de 2 (saldo)",
    monto: formatear(centavos(Math.floor(r.precioFinalCentavos / 2))),
  };
  for (const p of [...partes, principal, externo].filter(Boolean)) {
    await notificar(db, "pago_confirmado", p.email, datos);
  }

  // Campanita para las 3 partes.
  const titulo = `Pago ${datos.mitad} confirmado ✓`;
  const cuerpo = `${prop.nombre} · ${r.codigo} · ${datos.monto}. Split dispersado automáticamente.`;
  await notificarEnApp(db, prop.propietarioId, { tipo: "pago", titulo, cuerpo, url: "/app/propietario" });
  await notificarEnApp(db, r.principalId, { tipo: "pago", titulo, cuerpo, url: "/app/principal" });
  await notificarEnApp(db, r.externoId, { tipo: "pago", titulo, cuerpo, url: "/app/externo/links" });
}
