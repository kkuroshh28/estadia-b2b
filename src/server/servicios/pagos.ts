import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  calendarioDias,
  eventosPasarela,
  linksDePago,
  propiedades,
  reservas,
  splits,
  transacciones,
} from "../db/schema";
import { transicionarReserva } from "./reservas";
import { centavos, liquidarReserva, type Centavos } from "@/lib/dinero";

/**
 * MOTOR DE PAGOS — los webhooks de la pasarela son la ÚNICA fuente de verdad.
 * La integración HTTP concreta (Wompi sandbox / MercadoPago) vive detrás de
 * PasarelaAdapter; la lógica financiera de abajo no cambia entre proveedores.
 */

export interface EventoPago {
  /** Referencia única del evento en la pasarela — clave de idempotencia. */
  pasarelaRef: string;
  linkId: string;
  montoCentavos: number;
  estado: "aprobada" | "rechazada";
}

export interface PasarelaAdapter {
  /** Verifica la firma del webhook. Lanza si es inválida. */
  verificarFirma(cuerpoCrudo: string, firma: string): EventoPago;
  /** Crea un link de pago real por el monto EXACTO en centavos. */
  crearLink(montoCentavos: number, referencia: string): Promise<{ url: string; ref: string }>;
  /** Ordena la dispersión a una cuenta certificada. */
  dispersar(cuentaId: string, montoCentavos: number, referencia: string): Promise<{ payoutRef: string }>;
}

export type ResultadoPago =
  | { resultado: "procesado"; transaccionId: string }
  | { resultado: "duplicado" } // idempotencia: ya se procesó este evento
  | { resultado: "fechas_tomadas" } // perdió la carrera: link invalidado, sin cobro
  | { resultado: "link_no_activo" };

/**
 * Procesa un evento de pago confirmado. TODO ocurre en UNA transacción:
 *  1. Idempotencia: INSERT del evento — duplicado ⇒ no-op.
 *  2. Lock del link (FOR UPDATE) y validación de estado.
 *  3. Pago 1: lock de los días del calendario (FOR UPDATE). Si alguno ya está
 *     tomado ⇒ ESTE pago perdió la carrera: link INVALIDADO, rollback del resto,
 *     nunca se registra split. "El primero que paga, gana."
 *  4. Bloqueo de días + invalidación de links competidores solapados.
 *  5. Transacción + splits EXACTOS (módulo dinero) + transición + auditoría.
 */
export async function procesarWebhookPago(db: Db, evento: EventoPago): Promise<ResultadoPago> {
  if (evento.estado !== "aprobada") return { resultado: "link_no_activo" };

  // Cinturón extra ante 40P01 (deadlock): la víctima se revierte COMPLETA
  // (incluida su marca de idempotencia, misma transacción), así que reintentar
  // es correcto y seguro.
  for (let intento = 1; ; intento++) {
    try {
      return await procesarUnaVez(db, evento);
    } catch (e) {
      if (esDeadlock(e) && intento < 3) continue;
      throw e;
    }
  }
}

function esDeadlock(e: unknown): boolean {
  let actual = e as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; actual && i < 5; i++) {
    if (actual.code === "40P01") return true;
    actual = actual.cause as { code?: string; cause?: unknown } | undefined;
  }
  return false;
}

async function procesarUnaVez(db: Db, evento: EventoPago): Promise<ResultadoPago> {
  return await db.transaction(async (tx) => {
    // 1 · Idempotencia estricta
    const insertado = await tx
      .insert(eventosPasarela)
      .values({ pasarelaRef: evento.pasarelaRef, tipo: "pago", payload: evento })
      .onConflictDoNothing()
      .returning({ ref: eventosPasarela.pasarelaRef });
    if (insertado.length === 0) return { resultado: "duplicado" };

    // 2 · Lock del link
    const [link] = await tx
      .select()
      .from(linksDePago)
      .where(eq(linksDePago.id, evento.linkId))
      .for("update");
    if (!link || link.estado !== "activo") return { resultado: "link_no_activo" };
    if (link.montoCentavos !== evento.montoCentavos) {
      throw new Error(
        `Monto del webhook (${evento.montoCentavos}) no coincide con el link (${link.montoCentavos}) — se detiene el procesamiento`,
      );
    }

    const [reserva] = await tx
      .select()
      .from(reservas)
      .where(eq(reservas.id, link.reservaId))
      .for("update");
    if (!reserva) throw new Error(`Reserva no encontrada para link ${link.id}`);

    if (link.mitad === 1) {
      // 3a · Materializar las filas del rango que aún no existan (un día sin
      // fila cuenta como disponible, pero SIN fila no hay nada que lockear y
      // la carrera no se serializaría). ON CONFLICT DO NOTHING: bajo carrera,
      // el segundo espera el commit del primero y luego lockea las mismas filas.
      await tx.execute(sql`
        INSERT INTO calendario_dias (propiedad_id, fecha, estado)
        SELECT ${reserva.propiedadId}, d::date, 'disponible'
        FROM generate_series(${reserva.desde}::date, ${reserva.hasta}::date, interval '1 day') d
        ON CONFLICT (propiedad_id, fecha) DO NOTHING`);

      // 3b · Lock de los días del rango — aquí se decide la carrera
      const dias = await tx
        .select()
        .from(calendarioDias)
        .where(
          and(
            eq(calendarioDias.propiedadId, reserva.propiedadId),
            gte(calendarioDias.fecha, reserva.desde),
            lte(calendarioDias.fecha, reserva.hasta),
          ),
        )
        .for("update");

      const tomado = dias.some((d) => d.estado !== "disponible");
      if (tomado) {
        // Perdió la carrera: link invalidado; el checkout mostrará
        // "Fechas ya no disponibles". La anulación del cobro en la pasarela
        // la ejecuta el job de compensación (ver runbook).
        await tx
          .update(linksDePago)
          .set({ estado: "invalidado" })
          .where(eq(linksDePago.id, link.id));
        return { resultado: "fechas_tomadas" };
      }

      // 4a · Bloqueo en firme de los días
      await tx
        .update(calendarioDias)
        .set({ estado: "reservado_app", reservaId: reserva.id, actualizadoEn: sql`now()` })
        .where(
          and(
            eq(calendarioDias.propiedadId, reserva.propiedadId),
            gte(calendarioDias.fecha, reserva.desde),
            lte(calendarioDias.fecha, reserva.hasta),
          ),
        );

      // 4b · Invalidar links activos competidores solapados (misma propiedad).
      // SKIP LOCKED evita el deadlock: si el rival tiene SU link bloqueado es
      // porque su webhook está corriendo — perderá la carrera de días y se
      // auto-invalidará. Jamás esperamos su lock mientras él espera los días.
      await tx.execute(sql`
        UPDATE links_de_pago SET estado = 'invalidado'
        WHERE id IN (
          SELECT lp.id FROM links_de_pago lp
          JOIN reservas r ON r.id = lp.reserva_id
          WHERE lp.estado = 'activo'
            AND lp.mitad = 1
            AND lp.id <> ${link.id}
            AND r.propiedad_id = ${reserva.propiedadId}
            AND r.id <> ${reserva.id}
            AND r.desde <= ${reserva.hasta} AND r.hasta >= ${reserva.desde}
          FOR UPDATE OF lp SKIP LOCKED
        )`);
    }

    // 5 · Registrar transacción + splits EXACTOS
    const liq = liquidarReserva(
      centavos(reserva.precioFinalCentavos),
      centavos(reserva.tarifaNetaCentavos),
    );
    const mitad = liq.mitades[link.mitad === 1 ? 0 : 1];
    verificarCuadre(mitad.montoCliente, mitad.tarifaNeta, mitad.split.comision);

    const [trx] = await tx
      .insert(transacciones)
      .values({
        linkId: link.id,
        pasarelaRef: evento.pasarelaRef,
        montoCentavos: mitad.montoCliente,
        estado: "aprobada",
      })
      .returning({ id: transacciones.id });

    // Beneficiario de la tarifa neta = el propietario de la propiedad (la
    // dispersión necesita saber a QUIÉN pagarle; NULL es solo la plataforma).
    const [prop] = await tx
      .select({ propietarioId: propiedades.propietarioId })
      .from(propiedades)
      .where(eq(propiedades.id, reserva.propiedadId));

    await tx.insert(splits).values([
      { transaccionId: trx.id, beneficiarioId: null, concepto: "comision_app", montoCentavos: mitad.split.app },
      { transaccionId: trx.id, beneficiarioId: reserva.principalId, concepto: "comision_principal", montoCentavos: mitad.split.principal },
      { transaccionId: trx.id, beneficiarioId: reserva.externoId, concepto: "comision_externo", montoCentavos: mitad.split.externo },
      // El propietario recibe tarifa neta; el fee de pasarela se descuenta en la
      // dispersión y se concilia contra el fee real reportado por la pasarela.
      { transaccionId: trx.id, beneficiarioId: prop?.propietarioId ?? null, concepto: "tarifa_neta", montoCentavos: mitad.tarifaNeta },
    ]);

    await tx
      .update(linksDePago)
      .set({ estado: "pagado" })
      .where(eq(linksDePago.id, link.id));

    return { resultado: "procesado", transaccionId: trx.id };
  });
  // La transición de estado (ANTICIPO_PAGADO / PAGO_COMPLETO) la ejecuta el
  // orquestador del webhook llamando a transicionPostPago tras "procesado":
  // queda en su propia transacción auditada sin alargar el lock del dinero.
}

/** El cuadre por mitad debe ser EXACTO al centavo; si no, se detiene todo. */
function verificarCuadre(monto: Centavos, neta: Centavos, comision: Centavos) {
  if (neta + comision !== monto) {
    throw new Error(
      `CONCILIACIÓN ROTA: neta(${neta}) + comisión(${comision}) ≠ monto(${monto})`,
    );
  }
}

/** Transición de estado post-pago (la llama el orquestador tras procesar). */
export async function transicionPostPago(
  db: Db,
  reservaId: string,
  mitad: number,
): Promise<void> {
  await transicionarReserva(
    db,
    reservaId,
    mitad === 1 ? "ANTICIPO_PAGADO" : "PAGO_COMPLETO",
    "webhook:pasarela",
    { mitad },
  );
}

/**
 * Genera (idempotente) el link del SALDO — mitad 2. Solo sobre una reserva
 * ANTICIPO_PAGADO y solo para sus participantes. El monto sale del motor
 * (liquidarReserva): imposible digitarlo. Vence en 24 h o al llegar el
 * check-in, lo que ocurra primero.
 */
export class SaldoError extends Error {}

export async function generarLinkSaldo(
  db: Db,
  reservaId: string,
  actorId: string,
): Promise<{ linkId: string; montoCentavos: number; yaExistia: boolean }> {
  return await db.transaction(async (tx) => {
    const [reserva] = await tx
      .select()
      .from(reservas)
      .where(eq(reservas.id, reservaId))
      .for("update");
    if (!reserva) throw new SaldoError("Reserva no encontrada.");
    if (reserva.principalId !== actorId && reserva.externoId !== actorId) {
      throw new SaldoError("No eres parte de esta reserva.");
    }

    // Idempotencia: si el link 2 ya existe, se devuelve (índice único reserva+mitad).
    const [existente] = await tx
      .select()
      .from(linksDePago)
      .where(and(eq(linksDePago.reservaId, reservaId), eq(linksDePago.mitad, 2)));
    if (existente) {
      return { linkId: existente.id, montoCentavos: existente.montoCentavos, yaExistia: true };
    }

    if (reserva.estado !== "ANTICIPO_PAGADO") {
      throw new SaldoError("El saldo solo se genera con el anticipo pagado.");
    }

    const liq = liquidarReserva(
      centavos(reserva.precioFinalCentavos),
      centavos(reserva.tarifaNetaCentavos),
    );
    const [link] = await tx
      .insert(linksDePago)
      .values({
        reservaId,
        mitad: 2,
        montoCentavos: liq.mitades[1].montoCliente,
        url: `/pago/${crypto.randomUUID()}`,
        // 24 h de vigencia, pero nunca más allá de la medianoche del check-in.
        venceEn: sql`LEAST(now() + interval '24 hours', ${reserva.desde}::timestamp)` as unknown as Date,
      })
      .returning({ id: linksDePago.id, montoCentavos: linksDePago.montoCentavos });

    return { linkId: link.id, montoCentavos: link.montoCentavos, yaExistia: false };
  }).then(async (r) => {
    if (!r.yaExistia) {
      await transicionarReserva(db, reservaId, "SALDO_LINK_ENVIADO", actorId, { mitad: 2 });
    }
    return r;
  });
}
