import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  auditoriaAdmin, calendarioDias, configuracionPlataforma, contratos, intentosFuga,
  linksDePago, listaNegraIdentidad, propiedades, reservas, splits, transacciones, usuarios,
} from "../db/schema";
import { transicionarReserva } from "./reservas";
import { notificarEnApp } from "./notificaciones";
import { exigirAdmin, type UsuarioSesion } from "../auth";
import { obtenerPasarela } from "../adaptadores/pasarela";
import { obtenerKyc } from "../adaptadores/kyc";

/**
 * Operaciones del panel /admin. TODAS exigen sesión admin ELEVADA (TOTP) y
 * quedan en auditoria_admin (append-only) con actor y detalle.
 */

async function auditar(db: Db, admin: UsuarioSesion, accion: string, detalle?: object) {
  await db.insert(auditoriaAdmin).values({ adminId: admin.id, accion, detalle: detalle ?? null });
}

// ── 1 · Verificaciones ───────────────────────────────────────────────────────

export async function aprobarPropiedad(db: Db, actor: UsuarioSesion | null, propiedadId: string) {
  const admin = exigirAdmin(actor);
  await db.update(propiedades).set({ verificada: true }).where(eq(propiedades.id, propiedadId));
  await auditar(db, admin, "aprobar_propiedad", { propiedadId });
}

export async function resolverKycManual(
  db: Db,
  actor: UsuarioSesion | null,
  checkId: string,
  aprobado: boolean,
) {
  const admin = exigirAdmin(actor);
  // Pasa por el MISMO núcleo del adaptador (lista negra incluida).
  const estado = await obtenerKyc().procesarResultado(db, { checkId, aprobado });
  await auditar(db, admin, "kyc_manual", { checkId, aprobado, estado });
  return estado;
}

// ── 2 · Anti-fuga ────────────────────────────────────────────────────────────

/**
 * Reversión de ban: SOLO superadmin, doble confirmación (frase exacta) y
 * auditada. La política pública es perpetuo; esto existe para errores del
 * SISTEMA, no para negociar. El alias retirado JAMÁS vuelve.
 */
export async function revertirBan(
  db: Db,
  actor: UsuarioSesion | null,
  usuarioId: string,
  confirmacion: string,
  motivo: string,
) {
  const admin = exigirAdmin(actor);
  if (confirmacion !== "REVERTIR BAN DEFINITIVAMENTE") {
    throw new Error("Confirmación incorrecta: escribe la frase exacta.");
  }
  if (!motivo || motivo.trim().length < 20) {
    throw new Error("El motivo de la reversión debe documentarse (mínimo 20 caracteres).");
  }
  return await db.transaction(async (tx) => {
    const [u] = await tx.select().from(usuarios).where(eq(usuarios.id, usuarioId)).for("update");
    if (!u || u.estado !== "baneado") throw new Error("El usuario no está baneado.");
    await tx.delete(listaNegraIdentidad).where(eq(listaNegraIdentidad.cedulaHash, u.cedulaHash));
    await tx.update(usuarios).set({ estado: "activo" }).where(eq(usuarios.id, usuarioId));
    await tx.insert(intentosFuga).values({
      usuarioId,
      evidencia: { motivo, revertidoPor: admin.email },
      accion: "reversion_admin",
    });
    await tx
      .insert(auditoriaAdmin)
      .values({ adminId: admin.id, accion: "revertir_ban", detalle: { usuarioId, motivo } });
    // Nota: el alias retirado NO se restaura — recibirá alias nuevo al operar.
  });
}

// ── 3 · Dinero ───────────────────────────────────────────────────────────────

/** Conciliación: por cada transacción aprobada, Σ splits = monto EXACTO. */
export async function conciliar(db: Db): Promise<{
  cuadra: boolean;
  transacciones: number;
  descuadres: { transaccionId: string; monto: number; sumaSplits: number }[];
}> {
  const filas = await db
    .select({
      transaccionId: transacciones.id,
      monto: transacciones.montoCentavos,
      sumaSplits: sql<number>`coalesce(sum(${splits.montoCentavos}), 0)::bigint`,
    })
    .from(transacciones)
    .leftJoin(splits, eq(splits.transaccionId, transacciones.id))
    .where(eq(transacciones.estado, "aprobada"))
    .groupBy(transacciones.id, transacciones.montoCentavos);

  const descuadres = filas
    .filter((f) => Number(f.sumaSplits) !== Number(f.monto))
    .map((f) => ({ ...f, sumaSplits: Number(f.sumaSplits), monto: Number(f.monto) }));
  return { cuadra: descuadres.length === 0, transacciones: filas.length, descuadres };
}

export async function reembolsar(
  db: Db,
  actor: UsuarioSesion | null,
  transaccionId: string,
  confirmacion: string,
) {
  const admin = exigirAdmin(actor);
  if (confirmacion !== "CONFIRMO REEMBOLSO") {
    throw new Error("Confirmación incorrecta: escribe la frase exacta.");
  }
  return await db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(transacciones)
      .where(and(eq(transacciones.id, transaccionId), eq(transacciones.estado, "aprobada")))
      .for("update");
    if (!t) throw new Error("Transacción no encontrada o no reembolsable.");

    const { refundRef } = await obtenerPasarela().reembolsar(t.pasarelaRef, t.montoCentavos);
    await tx.update(transacciones).set({ estado: "reversada" }).where(eq(transacciones.id, t.id));
    // Contra-splits: la conciliación sigue cuadrando al centavo.
    const filas = await tx.select().from(splits).where(eq(splits.transaccionId, t.id));
    for (const s of filas) {
      await tx.insert(splits).values({
        transaccionId: t.id,
        beneficiarioId: s.beneficiarioId,
        concepto: s.concepto,
        montoCentavos: -s.montoCentavos,
        dispersado: false,
        pasarelaPayoutRef: refundRef,
      });
    }
    await tx
      .insert(auditoriaAdmin)
      .values({ adminId: admin.id, accion: "reembolso", detalle: { transaccionId, refundRef } });

    // El reembolso CANCELA la reserva: se liberan los días (el calendario
    // nunca miente) y se invalida cualquier link vivo. Notifica a las partes.
    const [link] = await tx.select().from(linksDePago).where(eq(linksDePago.id, t.linkId));
    const [reserva] = link
      ? await tx.select().from(reservas).where(eq(reservas.id, link.reservaId)).for("update")
      : [];
    if (reserva && ["ANTICIPO_PAGADO", "SALDO_LINK_ENVIADO", "PAGO_COMPLETO"].includes(reserva.estado)) {
      await tx
        .update(calendarioDias)
        .set({ estado: "disponible", reservaId: null, actualizadoEn: sql`now()` })
        .where(and(eq(calendarioDias.reservaId, reserva.id), eq(calendarioDias.estado, "reservado_app")));
      await tx
        .update(linksDePago)
        .set({ estado: "invalidado" })
        .where(and(eq(linksDePago.reservaId, reserva.id), eq(linksDePago.estado, "activo")));
    }
    return { refundRef, reservaId: reserva?.id ?? null, estadoReserva: reserva?.estado ?? null };
  }).then(async (r) => {
    // Transición + notificaciones FUERA de la tx del dinero (auditadas aparte).
    if (r.reservaId && r.estadoReserva && ["ANTICIPO_PAGADO", "SALDO_LINK_ENVIADO", "PAGO_COMPLETO"].includes(r.estadoReserva)) {
      await transicionarReserva(db, r.reservaId, "CANCELADA", admin.id, {
        motivo: "reembolso_admin",
        refundRef: r.refundRef,
      });
      const [res] = await db.select().from(reservas).where(eq(reservas.id, r.reservaId));
      if (res) {
        const [prop] = await db.select().from(propiedades).where(eq(propiedades.id, res.propiedadId));
        const aviso = {
          tipo: "pago",
          titulo: "Reserva cancelada con reembolso",
          cuerpo: `${prop?.nombre ?? "La propiedad"} · ${res.codigo}: la plataforma reembolsó el pago y liberó las fechas.`,
        };
        if (prop) await notificarEnApp(db, prop.propietarioId, { ...aviso, url: "/app/propietario" });
        await notificarEnApp(db, res.principalId, { ...aviso, url: "/app/principal" });
        await notificarEnApp(db, res.externoId, { ...aviso, url: "/app/externo/links" });
      }
    }
    return r.refundRef;
  });
}

// ── 4 · Métricas ─────────────────────────────────────────────────────────────

export async function metricas(db: Db) {
  const [totales] = await db.select({
    reservas: sql<number>`(SELECT count(*) FROM reservas)::int`,
    pagadas: sql<number>`(SELECT count(*) FROM reservas WHERE estado IN ('ANTICIPO_PAGADO','SALDO_LINK_ENVIADO','PAGO_COMPLETO','CHECK_IN','COMPLETADA'))::int`,
    solicitudes: sql<number>`(SELECT count(*) FROM solicitudes)::int`,
    comisionPromedio: sql<number>`(SELECT coalesce(avg(precio_final_centavos - tarifa_neta_centavos),0)::bigint FROM reservas WHERE precio_final_centavos > 0)`,
    volumenCentavos: sql<number>`(SELECT coalesce(sum(monto_centavos),0)::bigint FROM transacciones WHERE estado='aprobada')`,
  }).from(sql`(SELECT 1) AS uno`);

  const porZona = await db.execute(sql`
    SELECT p.zona, count(r.id)::int AS reservas,
           coalesce(avg(r.precio_final_centavos - r.tarifa_neta_centavos),0)::bigint AS comision_promedio
    FROM reservas r JOIN propiedades p ON p.id = r.propiedad_id
    WHERE r.precio_final_centavos > 0
    GROUP BY p.zona ORDER BY reservas DESC`);

  return { totales, porZona };
}

// ── 5 · Configuración (editable y auditada) ─────────────────────────────────

export async function editarConfiguracion(
  db: Db,
  actor: UsuarioSesion | null,
  clave: string,
  valor: object,
) {
  const admin = exigirAdmin(actor);
  const PERMITIDAS = ["piso_comision", "vigencias", "split", "pasarela"];
  if (!PERMITIDAS.includes(clave)) throw new Error(`Clave no editable: ${clave}`);
  if (clave === "split") throw new Error("El split 50/40/10 es regla de negocio: no se edita por UI.");
  const [anterior] = await db
    .select()
    .from(configuracionPlataforma)
    .where(eq(configuracionPlataforma.clave, clave));
  await db
    .insert(configuracionPlataforma)
    .values({ clave, valor })
    .onConflictDoUpdate({
      target: configuracionPlataforma.clave,
      set: { valor, actualizadoEn: sql`now()` },
    });
  await auditar(db, admin, "editar_configuracion", { clave, anterior: anterior?.valor ?? null, nuevo: valor });
}

// ── Listados para las bandejas ───────────────────────────────────────────────

export async function bandejaVerificaciones(db: Db) {
  const props = await db
    .select()
    .from(propiedades)
    .where(eq(propiedades.verificada, false))
    .limit(50);
  const kycs = await db
    .select({ id: usuarios.id, email: usuarios.email, kycProveedorId: usuarios.kycProveedorId, creadoEn: usuarios.creadoEn })
    .from(usuarios)
    .where(eq(usuarios.estado, "pendiente_kyc"))
    .limit(50);
  return { props, kycs };
}

export async function bandejaAntifuga(db: Db) {
  const intentos = await db.select().from(intentosFuga).orderBy(desc(intentosFuga.registradoEn)).limit(100);
  const lista = await db.select().from(listaNegraIdentidad).orderBy(desc(listaNegraIdentidad.baneadoEn)).limit(100);
  const porUsuario = await db.execute(sql`
    SELECT u.id, u.email, u.estado, count(i.id)::int AS strikes
    FROM usuarios u JOIN intentos_fuga i ON i.usuario_id = u.id
    WHERE i.accion = 'bloqueado'
    GROUP BY u.id, u.email, u.estado ORDER BY strikes DESC LIMIT 50`);
  return { intentos, lista, porUsuario };
}

export async function bandejaDinero(db: Db) {
  const trx = await db.select().from(transacciones).orderBy(desc(transacciones.webhookEn)).limit(100);
  const splitsRecientes = await db.select().from(splits).limit(200);
  const contratosRecientes = await db.select().from(contratos).limit(50);
  return { trx, splits: splitsRecientes, contratos: contratosRecientes };
}
