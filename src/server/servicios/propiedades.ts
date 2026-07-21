import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  alias as tablaAlias,
  propiedades,
  reservas,
  suscripciones,
  tarifas,
  usuarios,
  vinculosComisionista,
} from "../db/schema";
import {
  MAX_PRINCIPALES,
  MIN_PRINCIPALES,
  puedeVincularPrincipal,
} from "@/lib/domain/reglas";

/**
 * Alta y gestión REAL del inventario del propietario:
 * - crearPropiedad: la propiedad + su tarifa neta nacen juntas; la suscripción
 *   del piloto se activa automática (regla #3 — cuando llegue el cobro real,
 *   la pasarela la gobierna).
 * - vincular/desvincular principales por alias (regla #4: máx 5; una propiedad
 *   PUBLICADA no puede quedar bajo el mínimo de 3).
 */

export class PropiedadError extends Error {}

const TIPOS = ["finca", "apartamento", "casa", "glamping"] as const;

export interface DatosNuevaPropiedad {
  nombre: string;
  municipio: string;
  zona: string;
  tipo: string;
  capacidad: number;
  habitaciones: number;
  banos: number;
  amenidades: string[];
  reglas: string[];
  tarifaNetaNochePesos: number;
  publicada: boolean;
}

export async function crearPropiedad(
  db: Db,
  propietarioId: string,
  datos: DatosNuevaPropiedad,
): Promise<{ propiedadId: string }> {
  const nombre = datos.nombre.trim();
  if (nombre.length < 3 || nombre.length > 80) {
    throw new PropiedadError("El nombre debe tener entre 3 y 80 caracteres.");
  }
  if (!TIPOS.includes(datos.tipo as (typeof TIPOS)[number])) {
    throw new PropiedadError("Tipo de propiedad inválido.");
  }
  if (datos.capacidad < 1 || datos.capacidad > 50) {
    throw new PropiedadError("Capacidad inválida (1–50).");
  }
  if (datos.habitaciones < 1 || datos.habitaciones > 30 || datos.banos < 1 || datos.banos > 30) {
    throw new PropiedadError("Habitaciones/baños inválidos.");
  }
  if (
    !Number.isSafeInteger(datos.tarifaNetaNochePesos) ||
    datos.tarifaNetaNochePesos < 50_000 ||
    datos.tarifaNetaNochePesos > 50_000_000
  ) {
    throw new PropiedadError("La tarifa neta por noche debe estar entre $50.000 y $50.000.000.");
  }

  return await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(propiedades)
      .values({
        propietarioId,
        nombre,
        municipio: datos.municipio.trim(),
        zona: datos.zona.trim(),
        tipo: datos.tipo,
        capacidad: datos.capacidad,
        habitaciones: datos.habitaciones,
        banos: datos.banos,
        amenidades: datos.amenidades.map((a) => a.trim()).filter(Boolean).slice(0, 12),
        reglas: datos.reglas.map((r) => r.trim()).filter(Boolean).slice(0, 12),
        publicada: datos.publicada,
      })
      .returning({ id: propiedades.id });

    // La tarifa nace con la propiedad: vigencia abierta desde hoy.
    await tx.insert(tarifas).values({
      propiedadId: p.id,
      desde: sql`CURRENT_DATE` as unknown as string,
      hasta: "2099-12-31",
      netaNocheCentavos: datos.tarifaNetaNochePesos * 100,
    });

    // Regla #3: piloto sin cobro — la suscripción se activa al primer alta.
    const [sus] = await tx
      .select({ id: suscripciones.id })
      .from(suscripciones)
      .where(eq(suscripciones.propietarioId, propietarioId));
    if (!sus) {
      await tx.insert(suscripciones).values({
        propietarioId,
        plan: "piloto",
        estado: "activa",
        renuevaEn: sql`CURRENT_DATE + interval '1 month'` as unknown as string,
      });
    }

    return { propiedadId: p.id };
  });
}

/** Vincula un principal por su ALIAS (su marca en el gremio). */
export async function vincularPrincipal(
  db: Db,
  propietarioId: string,
  propiedadId: string,
  aliasPrincipal: string,
): Promise<{ alias: string }> {
  return await db.transaction(async (tx) => {
    const [prop] = await tx
      .select({ id: propiedades.id })
      .from(propiedades)
      .where(and(eq(propiedades.id, propiedadId), eq(propiedades.propietarioId, propietarioId)))
      .for("update");
    if (!prop) throw new PropiedadError("La propiedad no existe o no te pertenece.");

    const limpio = aliasPrincipal.trim().toUpperCase();
    const [fila] = await tx
      .select({ usuarioId: tablaAlias.usuarioId })
      .from(tablaAlias)
      .where(and(eq(tablaAlias.alias, limpio), sql`NOT ${tablaAlias.retirado}`));
    if (!fila?.usuarioId) throw new PropiedadError(`No existe el alias ${limpio}.`);

    const [u] = await tx
      .select({ roles: usuarios.roles, estado: usuarios.estado })
      .from(usuarios)
      .where(eq(usuarios.id, fila.usuarioId));
    if (!u || u.estado !== "activo" || !u.roles.includes("principal")) {
      throw new PropiedadError(`${limpio} no es un comisionista principal activo.`);
    }

    const activos = await contarActivos(tx as unknown as Db, propiedadId);
    if (!puedeVincularPrincipal(activos)) {
      throw new PropiedadError(`Máximo ${MAX_PRINCIPALES} principales por propiedad.`);
    }

    await tx
      .insert(vinculosComisionista)
      .values({ propiedadId, principalId: fila.usuarioId })
      .onConflictDoUpdate({
        target: [vinculosComisionista.propiedadId, vinculosComisionista.principalId],
        set: { estado: "activo" },
      });
    return { alias: limpio };
  });
}

/**
 * Desvincula por alias. Una propiedad PUBLICADA no puede quedar bajo el
 * mínimo de 3 (regla #4); en montaje (no publicada) es libre.
 */
export async function desvincularPrincipal(
  db: Db,
  propietarioId: string,
  propiedadId: string,
  aliasPrincipal: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [prop] = await tx
      .select({ publicada: propiedades.publicada })
      .from(propiedades)
      .where(and(eq(propiedades.id, propiedadId), eq(propiedades.propietarioId, propietarioId)))
      .for("update");
    if (!prop) throw new PropiedadError("La propiedad no existe o no te pertenece.");

    const limpio = aliasPrincipal.trim().toUpperCase();
    const [fila] = await tx
      .select({ usuarioId: tablaAlias.usuarioId })
      .from(tablaAlias)
      .where(eq(tablaAlias.alias, limpio));
    if (!fila?.usuarioId) throw new PropiedadError(`No existe el alias ${limpio}.`);

    const activos = await contarActivos(tx as unknown as Db, propiedadId);
    if (prop.publicada && activos <= MIN_PRINCIPALES) {
      throw new PropiedadError(
        `Una propiedad publicada necesita mínimo ${MIN_PRINCIPALES} principales.`,
      );
    }

    // Con reservas en curso el vínculo no se borra: queda 'removido' (historial).
    const [{ enCurso }] = await tx
      .select({ enCurso: sql<number>`count(*)::int` })
      .from(reservas)
      .where(
        and(
          eq(reservas.propiedadId, propiedadId),
          eq(reservas.principalId, fila.usuarioId),
          sql`${reservas.estado} NOT IN ('COMPLETADA','EXPIRADA','INVALIDADA','RECHAZADA','CANCELADA')`,
        ),
      );
    if (enCurso > 0) {
      throw new PropiedadError(`${limpio} tiene reservas en curso en esta propiedad.`);
    }

    await tx
      .update(vinculosComisionista)
      .set({ estado: "removido" })
      .where(
        and(
          eq(vinculosComisionista.propiedadId, propiedadId),
          eq(vinculosComisionista.principalId, fila.usuarioId),
        ),
      );
  });
}

async function contarActivos(db: Db, propiedadId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vinculosComisionista)
    .where(
      and(
        eq(vinculosComisionista.propiedadId, propiedadId),
        eq(vinculosComisionista.estado, "activo"),
      ),
    );
  return n;
}

/**
 * Edición de la propiedad por su dueño. La tarifa se maneja por TEMPORADAS:
 * cambiarla cierra la vigencia actual (hasta ayer) y abre una nueva desde hoy
 * — el histórico queda intacto para reservas ya liquidadas.
 */
export interface CambiosPropiedad {
  nombre?: string;
  municipio?: string;
  zona?: string;
  capacidad?: number;
  habitaciones?: number;
  banos?: number;
  amenidades?: string[];
  reglas?: string[];
  publicada?: boolean;
  tarifaNetaNochePesos?: number;
}

export async function editarPropiedad(
  db: Db,
  propietarioId: string,
  propiedadId: string,
  cambios: CambiosPropiedad,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [prop] = await tx
      .select({ id: propiedades.id })
      .from(propiedades)
      .where(and(eq(propiedades.id, propiedadId), eq(propiedades.propietarioId, propietarioId)))
      .for("update");
    if (!prop) throw new PropiedadError("La propiedad no existe o no te pertenece.");

    const campos: Record<string, unknown> = {};
    if (cambios.nombre !== undefined) {
      const n = cambios.nombre.trim();
      if (n.length < 3 || n.length > 80) throw new PropiedadError("Nombre inválido (3–80).");
      campos.nombre = n;
    }
    if (cambios.municipio !== undefined) campos.municipio = cambios.municipio.trim();
    if (cambios.zona !== undefined) campos.zona = cambios.zona.trim();
    if (cambios.capacidad !== undefined) {
      if (cambios.capacidad < 1 || cambios.capacidad > 50) throw new PropiedadError("Capacidad inválida.");
      campos.capacidad = cambios.capacidad;
    }
    if (cambios.habitaciones !== undefined) campos.habitaciones = cambios.habitaciones;
    if (cambios.banos !== undefined) campos.banos = cambios.banos;
    if (cambios.amenidades !== undefined) {
      campos.amenidades = cambios.amenidades.map((a) => a.trim()).filter(Boolean).slice(0, 12);
    }
    if (cambios.reglas !== undefined) {
      campos.reglas = cambios.reglas.map((r) => r.trim()).filter(Boolean).slice(0, 12);
    }
    if (cambios.publicada !== undefined) campos.publicada = cambios.publicada;
    if (Object.keys(campos).length > 0) {
      await tx.update(propiedades).set(campos).where(eq(propiedades.id, propiedadId));
    }

    if (cambios.tarifaNetaNochePesos !== undefined) {
      const t = cambios.tarifaNetaNochePesos;
      if (!Number.isSafeInteger(t) || t < 50_000 || t > 50_000_000) {
        throw new PropiedadError("La tarifa neta debe estar entre $50.000 y $50.000.000.");
      }
      // Cerrar la vigencia que cubre hoy y abrir la nueva desde hoy.
      await tx.execute(sql`
        UPDATE tarifas SET hasta = CURRENT_DATE - 1
        WHERE propiedad_id = ${propiedadId}
          AND desde < CURRENT_DATE AND hasta >= CURRENT_DATE`);
      await tx.execute(sql`
        DELETE FROM tarifas
        WHERE propiedad_id = ${propiedadId} AND desde >= CURRENT_DATE`);
      await tx.insert(tarifas).values({
        propiedadId,
        desde: sql`CURRENT_DATE` as unknown as string,
        hasta: "2099-12-31",
        netaNocheCentavos: t * 100,
      });
    }
  });
}
