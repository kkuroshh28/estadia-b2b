import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  configuracionPlataforma,
  negociaciones,
  ofertas,
  propiedades,
  reservas,
  solicitudes,
  suscripciones,
  tarifas,
  vinculosComisionista,
} from "../db/schema";
import { nochesEntre, validarDuracion } from "@/lib/domain/reglas";
import { centavos } from "@/lib/dinero";
import { aceptarOfertaYGenerarLink, obtenerPisoComision, validarPropuestaServidor } from "./negociacion";
import { aceptarSolicitud, transicionarReserva } from "./reservas";

/**
 * Ciclo operativo solicitud → negociación, con TODAS las reglas en servidor:
 * - Regla #2: 1–92 noches, fechas válidas.
 * - Regla #3: solo propiedades publicadas de propietarios con suscripción activa.
 * - Solo un principal VINCULADO a la propiedad puede aceptar.
 * - "El primero que acepta gana" es un UPDATE condicional atómico.
 * - Turno y validez de ofertas (≥ neta, piso configurable) en cada contraoferta.
 */

export class OperacionError extends Error {}

async function vigencias(db: Db): Promise<{ solicitudMin: number; ofertaHoras: number }> {
  const [fila] = await db
    .select()
    .from(configuracionPlataforma)
    .where(eq(configuracionPlataforma.clave, "vigencias"));
  const v = (fila?.valor ?? {}) as { solicitud_min?: number; oferta_horas?: number };
  return { solicitudMin: v.solicitud_min ?? 30, ofertaHoras: v.oferta_horas ?? 6 };
}

/** Tarifa neta TOTAL (centavos) para el rango: tarifa vigente × noches. */
async function tarifaNetaTotal(db: Db, propiedadId: string, desde: string, hasta: string): Promise<number> {
  const filas = await db
    .select()
    .from(tarifas)
    .where(eq(tarifas.propiedadId, propiedadId));
  const vigente = filas.find((t) => t.desde <= desde && desde <= t.hasta) ?? filas[0];
  if (!vigente) throw new OperacionError("La propiedad no tiene tarifa configurada.");
  return vigente.netaNocheCentavos * nochesEntre(desde, hasta);
}

export async function crearSolicitud(
  db: Db,
  datos: { externoId: string; propiedadId: string; desde: string; hasta: string; huespedes: number },
): Promise<{ solicitudId: string; venceEn: Date }> {
  const duracion = validarDuracion(datos.desde, datos.hasta);
  if (!duracion.valida) throw new OperacionError(duracion.motivo ?? "Fechas inválidas.");
  if (datos.huespedes < 1) throw new OperacionError("Huéspedes inválidos.");

  const [prop] = await db
    .select({
      id: propiedades.id,
      publicada: propiedades.publicada,
      capacidad: propiedades.capacidad,
      propietarioId: propiedades.propietarioId,
    })
    .from(propiedades)
    .where(eq(propiedades.id, datos.propiedadId));
  if (!prop || !prop.publicada) throw new OperacionError("La propiedad no está publicada.");
  if (datos.huespedes > prop.capacidad) {
    throw new OperacionError(`La propiedad admite máximo ${prop.capacidad} huéspedes.`);
  }

  // Regla #3: sin suscripción activa del propietario no se opera.
  const [sus] = await db
    .select({ estado: suscripciones.estado })
    .from(suscripciones)
    .where(eq(suscripciones.propietarioId, prop.propietarioId));
  if (sus?.estado !== "activa") {
    throw new OperacionError("La propiedad no está operativa (suscripción inactiva).");
  }

  const { solicitudMin } = await vigencias(db);
  const [fila] = await db
    .insert(solicitudes)
    .values({
      externoId: datos.externoId,
      propiedadId: datos.propiedadId,
      desde: datos.desde,
      hasta: datos.hasta,
      huespedes: datos.huespedes,
      venceEn: sql`now() + (${solicitudMin} * interval '1 minute')` as unknown as Date,
    })
    .returning({ id: solicitudes.id, venceEn: solicitudes.venceEn });
  return { solicitudId: fila.id, venceEn: fila.venceEn };
}

/** Código legible y único de reserva: CIR-YYYY-NNNNN (secuencia por año). */
async function generarCodigoReserva(db: Db): Promise<string> {
  const ano = new Date().getFullYear();
  const [{ n }] = (await db.execute(
    sql`SELECT count(*)::int AS n FROM reservas WHERE codigo LIKE ${"CIR-" + ano + "-%"}`,
  )) as unknown as [{ n: number }];
  // Colisión bajo concurrencia → el índice único de codigo la detecta y se reintenta.
  return `CIR-${ano}-${String(400 + n + 1).padStart(5, "0")}`;
}

export async function aceptarYAbrirNegociacion(
  db: Db,
  solicitudId: string,
  principalId: string,
): Promise<{ gano: boolean; negociacionId?: string; reservaId?: string }> {
  const [sol] = await db.select().from(solicitudes).where(eq(solicitudes.id, solicitudId));
  if (!sol) throw new OperacionError("Solicitud no encontrada.");

  // Solo un principal VINCULADO (activo) a la propiedad puede aceptarla.
  const [vinculo] = await db
    .select({ estado: vinculosComisionista.estado })
    .from(vinculosComisionista)
    .where(
      and(
        eq(vinculosComisionista.propiedadId, sol.propiedadId),
        eq(vinculosComisionista.principalId, principalId),
        eq(vinculosComisionista.estado, "activo"),
      ),
    );
  if (!vinculo) throw new OperacionError("No estás vinculado a esta propiedad.");

  const gano = await aceptarSolicitud(db, solicitudId, principalId);
  if (!gano) return { gano: false };

  const neta = await tarifaNetaTotal(db, sol.propiedadId, sol.desde, sol.hasta);

  for (let intento = 0; intento < 3; intento++) {
    try {
      const codigo = await generarCodigoReserva(db);
      const resultado = await db.transaction(async (tx) => {
        const [res] = await tx
          .insert(reservas)
          .values({
            codigo,
            solicitudId,
            propiedadId: sol.propiedadId,
            principalId,
            externoId: sol.externoId,
            desde: sol.desde,
            hasta: sol.hasta,
            estado: "NEGOCIACION",
            precioFinalCentavos: 0,
            tarifaNetaCentavos: neta,
          })
          .returning({ id: reservas.id });
        const [neg] = await tx
          .insert(negociaciones)
          .values({ solicitudId, tarifaNetaCentavos: neta })
          .returning({ id: negociaciones.id });
        return { reservaId: res.id, negociacionId: neg.id };
      });
      return { gano: true, ...resultado };
    } catch (e) {
      if (esUnicidad(e) && intento < 2) continue; // codigo en carrera: reintenta
      throw e;
    }
  }
  throw new OperacionError("No fue posible crear la reserva.");
}

function esUnicidad(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505");
}

/**
 * Contraoferta: valida participante, turno y monto (≥ neta + piso si activo);
 * expira las activas y crea la nueva con vigencia de configuración.
 */
export async function contraofertar(
  db: Db,
  negociacionId: string,
  emisorId: string,
  montoCentavos: number,
): Promise<{ ofertaId: string }> {
  return await db.transaction(async (tx) => {
    const [neg] = await tx
      .select()
      .from(negociaciones)
      .where(eq(negociaciones.id, negociacionId))
      .for("update");
    if (!neg || neg.estado !== "abierta") {
      throw new OperacionError("La negociación no está abierta.");
    }
    const [sol] = await tx.select().from(solicitudes).where(eq(solicitudes.id, neg.solicitudId));
    const participantes = [sol?.externoId, sol?.principalAceptanteId];
    if (!participantes.includes(emisorId)) {
      throw new OperacionError("No eres parte de esta negociación.");
    }

    const activas = await tx
      .select()
      .from(ofertas)
      .where(and(eq(ofertas.negociacionId, negociacionId), eq(ofertas.estado, "activa")))
      .for("update");
    if (activas.some((o) => o.emisorId === emisorId)) {
      throw new OperacionError("Es el turno de la otra parte.");
    }

    const piso = await obtenerPisoComision(tx as unknown as Db);
    const validacion = validarPropuestaServidor(
      centavos(montoCentavos),
      centavos(neg.tarifaNetaCentavos),
      piso,
    );
    if (!validacion.valida) throw new OperacionError(validacion.motivo);

    if (activas.length) {
      await tx
        .update(ofertas)
        .set({ estado: "contraofertada" })
        .where(and(eq(ofertas.negociacionId, negociacionId), eq(ofertas.estado, "activa")));
    }
    const { ofertaHoras } = await vigencias(tx as unknown as Db);
    const [nueva] = await tx
      .insert(ofertas)
      .values({
        negociacionId,
        emisorId,
        montoCentavos,
        venceEn: sql`now() + (${ofertaHoras} * interval '1 hour')` as unknown as Date,
      })
      .returning({ id: ofertas.id });
    return { ofertaId: nueva.id };
  });
}

/**
 * Acepta la oferta activa de la contraparte: el link del Pago 1 sale del motor
 * (regla #6) y la reserva transiciona PRECIO_ACORDADO → LINK_1_ENVIADO.
 */
export async function aceptarOferta(
  db: Db,
  ofertaId: string,
  aceptanteId: string,
): Promise<{ linkId: string; montoCentavos: number; reservaId: string }> {
  const r = await aceptarOfertaYGenerarLink(db, ofertaId, aceptanteId);

  const [of] = await db.select().from(ofertas).where(eq(ofertas.id, ofertaId));
  const [neg] = await db
    .select()
    .from(negociaciones)
    .where(eq(negociaciones.id, of.negociacionId));
  const [res] = await db.select().from(reservas).where(eq(reservas.solicitudId, neg.solicitudId));

  await transicionarReserva(db, res.id, "PRECIO_ACORDADO", aceptanteId);
  await transicionarReserva(db, res.id, "LINK_1_ENVIADO", "sistema");
  return { ...r, reservaId: res.id };
}
