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
import { aceptarSolicitud } from "./reservas";
import { notificarEnApp } from "./notificaciones";
import { alias as tablaAlias, vinculosComisionista as vinculos } from "../db/schema";
import { formatear, centavos as aCentavos } from "@/lib/dinero";

/** Alias activo de un usuario (para los textos de notificación). */
async function aliasDeUsuario(db: Db, usuarioId: string): Promise<string> {
  const [a] = await db
    .select({ alias: tablaAlias.alias })
    .from(tablaAlias)
    .where(and(eq(tablaAlias.usuarioId, usuarioId), sql`NOT ${tablaAlias.retirado}`));
  return a?.alias ?? "un socio";
}

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

/** Suma días a una fecha-calendario ISO sin pasar por la zona del proceso. */
function fechaMasDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias, 12));
  return f.toISOString().slice(0, 10);
}

/**
 * Tarifa neta TOTAL (centavos) para el rango, calculada NOCHE A NOCHE: cada
 * noche usa la tarifa vigente de SU fecha (los cruces de temporada se cobran
 * exactos, sin extrapolar el período del check-in). Sin vigencia para alguna
 * noche → error, jamás una tarifa arbitraria. Los huéspedes adicionales (por
 * encima de los incluidos) suman tarifa por persona-noche — ese extra también
 * es del propietario.
 */
async function tarifaNetaTotal(
  db: Db,
  propiedadId: string,
  desde: string,
  hasta: string,
  huespedes: number,
): Promise<number> {
  const filas = await db
    .select()
    .from(tarifas)
    .where(eq(tarifas.propiedadId, propiedadId));
  if (filas.length === 0) throw new OperacionError("La propiedad no tiene tarifa configurada.");
  const noches = nochesEntre(desde, hasta);

  const [prop] = await db
    .select({
      incluidos: propiedades.huespedesIncluidos,
      adicionalCentavos: propiedades.tarifaAdicionalCentavos,
    })
    .from(propiedades)
    .where(eq(propiedades.id, propiedadId));
  const extraPorNoche =
    prop?.incluidos != null && prop.adicionalCentavos > 0
      ? Math.max(0, huespedes - prop.incluidos) * prop.adicionalCentavos
      : 0;

  let total = 0;
  for (let i = 0; i < noches; i++) {
    const fecha = fechaMasDias(desde, i);
    const vigente = filas.find((t) => t.desde <= fecha && fecha <= t.hasta);
    if (!vigente) {
      throw new OperacionError(`No hay tarifa vigente para la noche del ${fecha}.`);
    }
    total += vigente.netaNocheCentavos + extraPorNoche;
  }
  return total;
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

  // Campanita: en Owner Direct al DUEÑO; si no, a TODOS los socios vinculados.
  const [propInfo] = await db
    .select({
      nombre: propiedades.nombre,
      ownerDirect: propiedades.ownerDirect,
      propietarioId: propiedades.propietarioId,
    })
    .from(propiedades)
    .where(eq(propiedades.id, datos.propiedadId));
  const aliasExterno = await aliasDeUsuario(db, datos.externoId);
  const cuerpoAviso = `${aliasExterno} pide ${propInfo?.nombre ?? "una propiedad"} (${datos.desde} → ${datos.hasta}). El primero que acepte se la queda.`;
  if (propInfo?.ownerDirect) {
    await notificarEnApp(db, propInfo.propietarioId, {
      tipo: "solicitud",
      titulo: "Nueva solicitud entrante (gestión directa)",
      cuerpo: cuerpoAviso,
      url: "/app/propietario",
    });
  } else {
    const principales = await db
      .select({ principalId: vinculos.principalId })
      .from(vinculos)
      .where(and(eq(vinculos.propiedadId, datos.propiedadId), eq(vinculos.estado, "activo")));
    await Promise.all(
      principales.map((p) =>
        notificarEnApp(db, p.principalId, {
          tipo: "solicitud",
          titulo: "Nueva solicitud entrante",
          cuerpo: cuerpoAviso,
          url: "/app/principal",
        }),
      ),
    );
  }
  return { solicitudId: fila.id, venceEn: fila.venceEn };
}

/**
 * Código legible y único de reserva: CIR-YYYY-NNNNN. Secuencia ATÓMICA de
 * Postgres (migración 0007): nextval jamás repite, ni con dos aceptaciones
 * en el mismo microsegundo. (El count(*) anterior colisionaba en carrera.)
 */
async function generarCodigoReserva(db: Db): Promise<string> {
  const ano = new Date().getFullYear();
  const [{ n }] = (await db.execute(
    sql`SELECT nextval('reservas_codigo_seq')::int AS n`,
  )) as unknown as [{ n: number }];
  return `CIR-${ano}-${String(n).padStart(5, "0")}`;
}

export async function aceptarYAbrirNegociacion(
  db: Db,
  solicitudId: string,
  principalId: string,
): Promise<{ gano: boolean; negociacionId?: string; reservaId?: string }> {
  const [sol] = await db.select().from(solicitudes).where(eq(solicitudes.id, solicitudId));
  if (!sol) throw new OperacionError("Solicitud no encontrada.");

  const [propOD] = await db
    .select({ ownerDirect: propiedades.ownerDirect, propietarioId: propiedades.propietarioId })
    .from(propiedades)
    .where(eq(propiedades.id, sol.propiedadId));

  if (propOD?.ownerDirect) {
    // Anexo I: en gestión directa SOLO el dueño acepta (actúa como socio
    // comercial y recibe esa participación del split automáticamente).
    if (principalId !== propOD.propietarioId) {
      throw new OperacionError("Esta propiedad es de gestión directa: solo su dueño negocia.");
    }
    // Anexo II: el dueño también negocia con identidad protegida.
    const { asegurarAlias } = await import("./alias");
    await asegurarAlias(db, principalId);
  } else {
    // Solo un socio comercial VINCULADO (activo) a la propiedad puede aceptarla.
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
  }

  // Cálculos de solo-lectura ANTES de la transacción.
  const neta = await tarifaNetaTotal(db, sol.propiedadId, sol.desde, sol.hasta, sol.huespedes);
  const codigo = await generarCodigoReserva(db);

  // TODO-O-NADA: ganar la carrera + crear reserva + abrir negociación en UNA
  // transacción. Si algo falla, el UPDATE se revierte y la solicitud vuelve a
  // estar disponible para otro socio (antes quedaba "aceptada" huérfana).
  const resultado = await db.transaction(async (tx) => {
    const gano = await aceptarSolicitud(tx as unknown as Db, solicitudId, principalId);
    if (!gano) return null;
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
  if (!resultado) return { gano: false };

  await notificarEnApp(db, sol.externoId, {
    tipo: "aceptada",
    titulo: "Tu solicitud fue aceptada",
    cuerpo: `${await aliasDeUsuario(db, principalId)} tomó tu solicitud. La negociación formal está abierta.`,
    url: "/app/negociacion",
  });
  return { gano: true, ...resultado };
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
    const [sol] = await tx
      .select()
      .from(solicitudes)
      .where(eq(solicitudes.id, neg.solicitudId))
      .for("update");
    if (!sol) throw new OperacionError("La solicitud de esta negociación no existe.");
    const participantes = [sol.externoId, sol.principalAceptanteId];
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
    const [propMargen] = await tx
      .select({ margen: propiedades.margenMinimoCentavos })
      .from(propiedades)
      .where(eq(propiedades.id, sol.propiedadId));
    const validacion = validarPropuestaServidor(
      centavos(montoCentavos),
      centavos(neg.tarifaNetaCentavos),
      piso,
      propMargen?.margen ?? 0,
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
    const contraparte = sol.externoId === emisorId ? sol.principalAceptanteId : sol.externoId;
    return { ofertaId: nueva.id, contraparte };
  }).then(async (r) => {
    if (r.contraparte) {
      await notificarEnApp(db, r.contraparte, {
        tipo: "oferta",
        titulo: "Tienes una oferta nueva",
        cuerpo: `${await aliasDeUsuario(db, emisorId)} propone ${formatear(aCentavos(montoCentavos))}. Vence en horas: responde.`,
        url: "/app/negociacion",
      });
    }
    return { ofertaId: r.ofertaId };
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
  // Las transiciones a PRECIO_ACORDADO y LINK_1_ENVIADO ocurren DENTRO de la
  // transacción del link (negociacion.ts) — aquí solo queda avisar.
  const r = await aceptarOfertaYGenerarLink(db, ofertaId, aceptanteId);

  const [of] = await db.select().from(ofertas).where(eq(ofertas.id, ofertaId));
  await notificarEnApp(db, of.emisorId, {
    tipo: "acuerdo",
    titulo: "Precio acordado — link del anticipo generado",
    cuerpo: `${await aliasDeUsuario(db, aceptanteId)} aceptó tu oferta de ${formatear(aCentavos(of.montoCentavos))}. Reenvía el link a tu cliente: el primero que paga gana.`,
    url: "/app/externo/links",
  });
  return r;
}
