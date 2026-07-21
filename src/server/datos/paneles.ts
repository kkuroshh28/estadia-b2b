import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  alias as tablaAlias,
  calendarioDias,
  sincronizacionesIcal,
  linksDePago,
  mensajesChat,
  intentosFuga,
  negociaciones,
  ofertas,
  propiedades,
  reservas,
  solicitudes,
  splits,
  suscripciones,
  tarifas,
  transacciones,
  vinculosComisionista,
} from "../db/schema";
import { hoyEnBogota, ZONA } from "@/lib/fechas";
import { clamparMes, infoMes } from "@/lib/domain/paneles";
import type {
  DatosBusquedaExterno,
  DatosCalendario,
  DatosChat,
  DatosComisiones,
  DatosFicha,
  DatosLinksExterno,
  DatosNegociacion,
  DatosPrincipal,
  DatosPrincipales,
  DatosPropietario,
  ReservaPanel,
  SolicitudPanel,
  SplitLiquidado,
} from "@/lib/domain/paneles";
import type { EstadoDia, EstadoReserva, Propiedad } from "@/lib/domain/tipos";
import {
  demoBusquedaExterno,
  demoCalendario,
  demoChat,
  demoComisiones,
  demoFicha,
  demoLinksExterno,
  demoNegociacion,
  demoPrincipal,
  demoPrincipales,
  demoPropietario,
} from "@/lib/data/demo-paneles";
import { matizDeId, resolverPanel } from "./fuente";

/** Paneles /app contra la DB real, scoped al usuario. Centavos → pesos aquí. */

const pesos = (centavos: number) => Math.round(centavos / 100);

function noches(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split("-").map(Number);
  const [y2, m2, d2] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

function mesCortoCO(fecha: Date): string {
  const s = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: ZONA }).format(fecha);
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(".", "");
}

function haceCuanto(desde: Date, ahora = new Date()): string {
  const min = Math.max(0, Math.round((ahora.getTime() - desde.getTime()) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

function formatearVence(v: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: ZONA,
  }).format(v);
}

/** Map usuarioId → alias activo. */
async function aliasDe(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const filas = await db
    .select({ usuarioId: tablaAlias.usuarioId, alias: tablaAlias.alias })
    .from(tablaAlias)
    .where(and(inArray(tablaAlias.usuarioId, ids), sql`NOT ${tablaAlias.retirado}`));
  return new Map(filas.filter((f) => f.usuarioId).map((f) => [f.usuarioId!, f.alias]));
}

/** Filas de propiedades → tipo UI (tarifa vigente + principales vinculados). */
async function propiedadesUI(
  db: Db,
  filas: (typeof propiedades.$inferSelect)[],
): Promise<Propiedad[]> {
  if (filas.length === 0) return [];
  const ids = filas.map((f) => f.id);
  const hoy = hoyEnBogota();

  const tarifasFilas = await db
    .select()
    .from(tarifas)
    .where(inArray(tarifas.propiedadId, ids))
    .orderBy(asc(tarifas.desde));
  const tarifaDe = new Map<string, number>();
  for (const t of tarifasFilas) {
    const vigente = t.desde <= hoy && hoy <= t.hasta;
    if (vigente || !tarifaDe.has(t.propiedadId)) tarifaDe.set(t.propiedadId, t.netaNocheCentavos);
  }

  const vinculos = await db
    .select({ propiedadId: vinculosComisionista.propiedadId, n: sql<number>`count(*)::int` })
    .from(vinculosComisionista)
    .where(and(inArray(vinculosComisionista.propiedadId, ids), eq(vinculosComisionista.estado, "activo")))
    .groupBy(vinculosComisionista.propiedadId);
  const vinculosDe = new Map(vinculos.map((v) => [v.propiedadId, v.n]));

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    zona: f.zona,
    municipio: f.municipio,
    tipo: f.tipo as Propiedad["tipo"],
    capacidad: f.capacidad,
    habitaciones: f.habitaciones,
    banos: f.banos,
    tarifaNetaNoche: pesos(tarifaDe.get(f.id) ?? 0),
    verificada: f.verificada,
    amenidades: f.amenidades,
    reglas: f.reglas,
    matiz: matizDeId(f.id),
    principalesVinculados: vinculosDe.get(f.id) ?? 0,
  }));
}

/** Reservas → tipo UI con nombre de propiedad y alias de las partes. */
async function reservasUI(
  db: Db,
  filas: (typeof reservas.$inferSelect)[],
): Promise<ReservaPanel[]> {
  if (filas.length === 0) return [];
  const props = await db
    .select({ id: propiedades.id, nombre: propiedades.nombre })
    .from(propiedades)
    .where(inArray(propiedades.id, [...new Set(filas.map((f) => f.propiedadId))]));
  const nombreDe = new Map(props.map((p) => [p.id, p.nombre]));
  const alias = await aliasDe(db, [
    ...new Set(filas.flatMap((f) => [f.principalId, f.externoId])),
  ]);
  return filas.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    propiedadId: f.propiedadId,
    propiedadNombre: nombreDe.get(f.propiedadId) ?? "—",
    aliasPrincipal: alias.get(f.principalId) ?? "—",
    aliasExterno: alias.get(f.externoId) ?? "—",
    fechas: { desde: f.desde, hasta: f.hasta },
    noches: noches(f.desde, f.hasta),
    estado: f.estado as EstadoReserva,
    precioFinal: pesos(f.precioFinalCentavos),
    tarifaNetaTotal: pesos(f.tarifaNetaCentavos),
    checkIn: f.desde,
  }));
}

// ─── Propietario ─────────────────────────────────────────────────────────────

export function datosPropietario(): Promise<DatosPropietario> {
  return resolverPanel("propietario", demoPropietario, async (db, u) => {
    const misProps = await db
      .select()
      .from(propiedades)
      .where(eq(propiedades.propietarioId, u.id))
      .orderBy(asc(propiedades.creadaEn));
    const props = await propiedadesUI(db, misProps);

    const misReservas = misProps.length
      ? await db
          .select()
          .from(reservas)
          .where(inArray(reservas.propiedadId, misProps.map((p) => p.id)))
          .orderBy(desc(reservas.creadaEn))
          .limit(12)
      : [];

    const sus = await db
      .select({ estado: suscripciones.estado, renuevaEn: suscripciones.renuevaEn })
      .from(suscripciones)
      .where(eq(suscripciones.propietarioId, u.id))
      .limit(1);

    // Neto real dispersable: splits tarifa_neta del usuario, por mes (últ. 6).
    const netos = await db
      .select({ monto: splits.montoCentavos, fecha: transacciones.webhookEn })
      .from(splits)
      .innerJoin(transacciones, eq(splits.transaccionId, transacciones.id))
      .where(and(eq(splits.beneficiarioId, u.id), eq(splits.concepto, "tarifa_neta")))
      .orderBy(asc(transacciones.webhookEn));

    const porMes = new Map<string, number>();
    const mesActual = mesCortoCO(new Date());
    for (const n of netos) {
      const m = mesCortoCO(n.fecha);
      porMes.set(m, (porMes.get(m) ?? 0) + pesos(n.monto));
    }

    return {
      esDemo: false,
      netoMes: porMes.get(mesActual) ?? 0,
      suscripcion: sus[0] ?? null,
      propiedades: props,
      reservas: await reservasUI(db, misReservas),
      ingresosPorMes: [...porMes.entries()].slice(-6).map(([mes, neto]) => ({ mes, neto })),
    };
  });
}

export function datosCalendario(mesPedido?: string): Promise<DatosCalendario> {
  return resolverPanel("propietario", demoCalendario, async (db, u) => {
    const misProps = await db
      .select()
      .from(propiedades)
      .where(eq(propiedades.propietarioId, u.id))
      .orderBy(asc(propiedades.creadaEn));
    const props = await propiedadesUI(db, misProps);
    const ids = misProps.map((p) => p.id);

    // Mes pedido por el usuario (clampado al rango operable) o el actual.
    const mesActual = hoyEnBogota().slice(0, 7);
    const mesIso = clamparMes(mesPedido, mesActual);

    const dias = ids.length
      ? await db
          .select()
          .from(calendarioDias)
          .where(
            and(
              inArray(calendarioDias.propiedadId, ids),
              sql`to_char(${calendarioDias.fecha}::date, 'YYYY-MM') = ${mesIso}`,
              sql`${calendarioDias.estado} <> 'disponible'`,
            ),
          )
      : [];

    const estados: Record<string, Partial<Record<number, EstadoDia>>> = {};
    for (const d of dias) {
      const dia = Number(d.fecha.slice(8, 10));
      (estados[d.propiedadId] ??= {})[dia] = d.estado;
    }

    // iCal por propiedad: URL de export con token + imports configurados.
    const { tokenIcal } = await import("../servicios/ical");
    const importsFilas = ids.length
      ? await db
          .select()
          .from(sincronizacionesIcal)
          .where(inArray(sincronizacionesIcal.propiedadId, ids))
      : [];
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const ical: DatosCalendario["ical"] = {};
    for (const p of props) {
      ical[p.id] = {
        exportUrl: `${base}/api/ical/${p.id}?token=${tokenIcal(p.id)}`,
        imports: importsFilas
          .filter((f) => f.propiedadId === p.id && f.direccion === "import")
          .map((f) => ({
            id: f.id,
            url: f.url,
            ultimaSync: f.ultimaSync ? f.ultimaSync.toISOString() : null,
          })),
      };
    }

    return { esDemo: false, mes: { iso: mesIso, ...infoMes(mesIso) }, propiedades: props, estados, ical };
  });
}

export function datosPrincipales(): Promise<DatosPrincipales> {
  return resolverPanel("propietario", demoPrincipales, async (db, u) => {
    const misProps = await db
      .select({ id: propiedades.id, nombre: propiedades.nombre })
      .from(propiedades)
      .where(eq(propiedades.propietarioId, u.id))
      .orderBy(asc(propiedades.creadaEn));
    const ids = misProps.map((p) => p.id);

    const vinculos = ids.length
      ? await db
          .select({
            propiedadId: vinculosComisionista.propiedadId,
            principalId: vinculosComisionista.principalId,
          })
          .from(vinculosComisionista)
          .where(and(inArray(vinculosComisionista.propiedadId, ids), eq(vinculosComisionista.estado, "activo")))
      : [];

    const alias = await aliasDe(db, [...new Set(vinculos.map((v) => v.principalId))]);

    const conteos = ids.length
      ? await db
          .select({
            propiedadId: reservas.propiedadId,
            principalId: reservas.principalId,
            n: sql<number>`count(*)::int`,
          })
          .from(reservas)
          .where(inArray(reservas.propiedadId, ids))
          .groupBy(reservas.propiedadId, reservas.principalId)
      : [];
    const conteoDe = new Map(conteos.map((c) => [`${c.propiedadId}:${c.principalId}`, c.n]));

    const porProp: DatosPrincipales["vinculos"] = {};
    for (const v of vinculos) {
      (porProp[v.propiedadId] ??= []).push({
        alias: alias.get(v.principalId) ?? "—",
        reservas: conteoDe.get(`${v.propiedadId}:${v.principalId}`) ?? 0,
        respuestaMin: null,
      });
    }

    return { esDemo: false, propiedades: misProps, vinculos: porProp };
  });
}

// ─── Principal ───────────────────────────────────────────────────────────────

export function datosPrincipal(): Promise<DatosPrincipal> {
  return resolverPanel("principal", demoPrincipal, async (db, u) => {
    const vinculadas = await db
      .select({ propiedadId: vinculosComisionista.propiedadId })
      .from(vinculosComisionista)
      .where(and(eq(vinculosComisionista.principalId, u.id), eq(vinculosComisionista.estado, "activo")));
    const ids = vinculadas.map((v) => v.propiedadId);

    const pendientes = ids.length
      ? await db
          .select()
          .from(solicitudes)
          .where(
            and(
              inArray(solicitudes.propiedadId, ids),
              sql`(${solicitudes.estado} = 'pendiente' AND ${solicitudes.venceEn} > now())
                  OR (${solicitudes.estado} = 'aceptada' AND ${solicitudes.principalAceptanteId} = ${u.id})`,
            ),
          )
          .orderBy(desc(solicitudes.creadaEn))
          .limit(10)
      : [];

    const idsProps = [...new Set(pendientes.map((s) => s.propiedadId))];
    const props = idsProps.length
      ? await db
          .select({ id: propiedades.id, nombre: propiedades.nombre })
          .from(propiedades)
          .where(inArray(propiedades.id, idsProps))
      : [];
    const nombreDe = new Map(props.map((p) => [p.id, p.nombre]));
    const alias = await aliasDe(db, [...new Set(pendientes.map((s) => s.externoId))]);
    const ahora = new Date();

    const solicitudesUI: SolicitudPanel[] = pendientes.map((s) => ({
      id: s.id,
      propiedadId: s.propiedadId,
      propiedadNombre: nombreDe.get(s.propiedadId) ?? "—",
      aliasExterno: alias.get(s.externoId) ?? "—",
      fechas: { desde: s.desde, hasta: s.hasta },
      noches: noches(s.desde, s.hasta),
      huespedes: s.huespedes,
      estado: s.estado as SolicitudPanel["estado"],
      recibidaHace: haceCuanto(s.creadaEn, ahora),
      vigenciaMin: Math.max(0, Math.round((s.venceEn.getTime() - ahora.getTime()) / 60_000)),
    }));

    const misReservas = await db
      .select()
      .from(reservas)
      .where(eq(reservas.principalId, u.id))
      .orderBy(desc(reservas.creadaEn))
      .limit(8);

    return {
      esDemo: false,
      aliasYo: u.alias,
      solicitudes: solicitudesUI,
      reservas: await reservasUI(db, misReservas),
    };
  });
}

// ─── Externo ─────────────────────────────────────────────────────────────────

export function datosBusquedaExterno(): Promise<DatosBusquedaExterno> {
  return resolverPanel("externo", demoBusquedaExterno, async (db, u) => {
    const publicadas = await db
      .select()
      .from(propiedades)
      .where(eq(propiedades.publicada, true))
      .orderBy(asc(propiedades.creadaEn));
    return {
      esDemo: false,
      aliasYo: u.alias,
      propiedades: await propiedadesUI(db, publicadas),
    };
  });
}

export function datosLinksExterno(): Promise<DatosLinksExterno> {
  return resolverPanel("externo", demoLinksExterno, async (db, u) => {
    const filas = await db
      .select({
        id: linksDePago.id,
        reservaId: linksDePago.reservaId,
        mitad: linksDePago.mitad,
        monto: linksDePago.montoCentavos,
        estado: linksDePago.estado,
        venceEn: linksDePago.venceEn,
        codigo: reservas.codigo,
        desde: reservas.desde,
        hasta: reservas.hasta,
        propiedadId: reservas.propiedadId,
      })
      .from(linksDePago)
      .innerJoin(reservas, eq(linksDePago.reservaId, reservas.id))
      .where(eq(reservas.externoId, u.id))
      .orderBy(desc(linksDePago.creadoEn))
      .limit(20);

    const idsProps = [...new Set(filas.map((f) => f.propiedadId))];
    const props = idsProps.length
      ? await db
          .select({ id: propiedades.id, nombre: propiedades.nombre })
          .from(propiedades)
          .where(inArray(propiedades.id, idsProps))
      : [];
    const nombreDe = new Map(props.map((p) => [p.id, p.nombre]));

    const noActivos = filas.filter((f) => f.estado !== "activo");
    const pagados = noActivos.filter((f) => f.estado === "pagado").length;

    // Comisiones del mes en curso (splits comision_externo del usuario).
    const mesActual = mesCortoCO(new Date());
    const comis = await db
      .select({ monto: splits.montoCentavos, fecha: transacciones.webhookEn })
      .from(splits)
      .innerJoin(transacciones, eq(splits.transaccionId, transacciones.id))
      .where(and(eq(splits.beneficiarioId, u.id), eq(splits.concepto, "comision_externo")));
    const comisionesMes = comis
      .filter((c) => mesCortoCO(c.fecha) === mesActual)
      .reduce((a, c) => a + pesos(c.monto), 0);

    // Reservas con anticipo pagado que aún no tienen link de saldo.
    const pendientes = await db
      .select({
        id: reservas.id,
        codigo: reservas.codigo,
        propiedadId: reservas.propiedadId,
        precio: reservas.precioFinalCentavos,
      })
      .from(reservas)
      .where(and(eq(reservas.externoId, u.id), sql`${reservas.estado} = 'ANTICIPO_PAGADO'`));
    const conLink2 = new Set(filas.filter((f) => f.mitad === 2).map((f) => f.reservaId));
    const saldosPendientes = pendientes
      .filter((p) => !conLink2.has(p.id))
      .map((p) => ({
        reservaId: p.id,
        codigo: p.codigo,
        propiedadNombre: nombreDe.get(p.propiedadId) ?? "—",
        montoPesos: pesos(p.precio - Math.floor(p.precio / 2)), // mitad 2 = resto exacto
      }));

    return {
      esDemo: false,
      aliasYo: u.alias,
      saldosPendientes,
      links: filas.map((f) => ({
        id: f.id,
        reservaId: f.reservaId,
        codigoReserva: f.codigo,
        propiedadNombre: nombreDe.get(f.propiedadId) ?? "—",
        mitad: f.mitad as 1 | 2,
        monto: pesos(f.monto),
        estado: f.estado,
        vence: f.estado === "activo" ? formatearVence(f.venceEn) : "—",
        fechas: { desde: f.desde, hasta: f.hasta },
      })),
      tasaPago: noActivos.length ? pagados / noActivos.length : null,
      comisionesMes,
    };
  });
}

// ─── Comisiones (compartido principal/externo) ───────────────────────────────

export function datosComisiones(rol: "principal" | "externo"): Promise<DatosComisiones> {
  return resolverPanel(rol, () => demoComisiones(), async (db, u) => {
    const concepto = rol === "principal" ? "comision_principal" : "comision_externo";
    const mios = await db
      .select({
        monto: splits.montoCentavos,
        dispersado: splits.dispersado,
        transaccionId: splits.transaccionId,
        fecha: transacciones.webhookEn,
        mitad: linksDePago.mitad,
        codigo: reservas.codigo,
        propiedadId: reservas.propiedadId,
      })
      .from(splits)
      .innerJoin(transacciones, eq(splits.transaccionId, transacciones.id))
      .innerJoin(linksDePago, eq(transacciones.linkId, linksDePago.id))
      .innerJoin(reservas, eq(linksDePago.reservaId, reservas.id))
      .where(and(eq(splits.beneficiarioId, u.id), eq(splits.concepto, concepto)))
      .orderBy(desc(transacciones.webhookEn))
      .limit(60);

    // Splits hermanos (para mostrar la liquidación completa de cada mitad).
    const hermanos = mios.length
      ? await db
          .select({
            transaccionId: splits.transaccionId,
            concepto: splits.concepto,
            monto: splits.montoCentavos,
          })
          .from(splits)
          .where(
            and(
              inArray(splits.transaccionId, [...new Set(mios.map((m) => m.transaccionId))]),
              sql`${splits.concepto} LIKE 'comision%'`,
            ),
          )
      : [];
    const porTransaccion = new Map<string, Record<string, number>>();
    for (const h of hermanos) {
      const m = porTransaccion.get(h.transaccionId) ?? {};
      m[h.concepto] = pesos(h.monto);
      porTransaccion.set(h.transaccionId, m);
    }

    const idsProps = [...new Set(mios.map((m) => m.propiedadId))];
    const props = idsProps.length
      ? await db
          .select({ id: propiedades.id, nombre: propiedades.nombre })
          .from(propiedades)
          .where(inArray(propiedades.id, idsProps))
      : [];
    const nombreDe = new Map(props.map((p) => [p.id, p.nombre]));

    const splitsUI: SplitLiquidado[] = mios.map((m) => {
      const liq = porTransaccion.get(m.transaccionId) ?? {};
      const principal = liq["comision_principal"] ?? 0;
      const externo = liq["comision_externo"] ?? 0;
      const app = liq["comision_app"] ?? 0;
      return {
        fecha: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", timeZone: ZONA })
          .format(m.fecha)
          .replace(".", ""),
        codigo: m.codigo,
        propiedad: nombreDe.get(m.propiedadId) ?? "—",
        mitad: m.mitad as 1 | 2,
        comisionTotal: principal + externo + app,
        principal,
        externo,
        dispersado: m.dispersado,
      };
    });

    const porMes = new Map<string, number>();
    for (const m of [...mios].reverse()) {
      const clave = mesCortoCO(m.fecha);
      porMes.set(clave, (porMes.get(clave) ?? 0) + pesos(m.monto));
    }

    const completadas = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(reservas)
      .where(
        and(
          eq(rol === "principal" ? reservas.principalId : reservas.externoId, u.id),
          sql`${reservas.estado} IN ('PAGO_COMPLETO', 'CHECK_IN', 'COMPLETADA')`,
        ),
      );

    return {
      esDemo: false,
      alias: u.alias,
      porMes: [...porMes.entries()].slice(-6).map(([mes, monto]) => ({ mes, monto })),
      splits: splitsUI,
      reservasCompletadas: completadas[0]?.n ?? 0,
    };
  });
}

// ─── Negociación ─────────────────────────────────────────────────────────────

export function datosNegociacion(): Promise<DatosNegociacion> {
  return resolverPanel("principal", demoNegociacion, async (db, u) => {
    const abiertas = await db
      .select({
        id: negociaciones.id,
        solicitudId: negociaciones.solicitudId,
        tarifaNeta: negociaciones.tarifaNetaCentavos,
        precioAcordado: negociaciones.precioAcordadoCentavos,
        desde: solicitudes.desde,
        hasta: solicitudes.hasta,
        propiedadId: solicitudes.propiedadId,
        externoId: solicitudes.externoId,
        principalId: solicitudes.principalAceptanteId,
      })
      .from(negociaciones)
      .innerJoin(solicitudes, eq(negociaciones.solicitudId, solicitudes.id))
      .where(
        and(
          eq(negociaciones.estado, "abierta"),
          sql`(${solicitudes.principalAceptanteId} = ${u.id} OR ${solicitudes.externoId} = ${u.id})`,
        ),
      )
      .orderBy(desc(solicitudes.creadaEn))
      .limit(1);

    const n = abiertas[0];
    if (!n) return { esDemo: false, negociacion: null, perspectivaFija: null };

    const [prop] = await db
      .select({ nombre: propiedades.nombre })
      .from(propiedades)
      .where(eq(propiedades.id, n.propiedadId));
    const alias = await aliasDe(db, [n.externoId, n.principalId].filter(Boolean) as string[]);

    const ofertasFilas = await db
      .select()
      .from(ofertas)
      .where(eq(ofertas.negociacionId, n.id))
      .orderBy(asc(ofertas.creadaEn));

    const tarifaNetaTotal = pesos(n.tarifaNeta);
    return {
      esDemo: false,
      negociacion: {
        id: n.id,
        solicitudId: n.solicitudId,
        propiedadId: n.propiedadId,
        propiedadNombre: prop?.nombre ?? "—",
        aliasPrincipal: (n.principalId && alias.get(n.principalId)) || "—",
        aliasExterno: alias.get(n.externoId) ?? "—",
        noches: noches(n.desde, n.hasta),
        fechas: { desde: n.desde, hasta: n.hasta },
        tarifaNetaTotal,
        precioAcordado: n.precioAcordado ? pesos(n.precioAcordado) : undefined,
        // Rango sugerido: heurística de mercado (+10% a +25% sobre la neta).
        rangoSugerido: {
          min: Math.round((tarifaNetaTotal * 1.1) / 10_000) * 10_000,
          max: Math.round((tarifaNetaTotal * 1.25) / 10_000) * 10_000,
        },
        ofertas: ofertasFilas.map((o) => ({
          id: o.id,
          emisor: o.emisorId === n.externoId ? ("externo" as const) : ("principal" as const),
          monto: pesos(o.montoCentavos),
          timestamp: new Intl.DateTimeFormat("es-CO", {
            hour: "numeric",
            minute: "2-digit",
            hour12: false,
            timeZone: ZONA,
          }).format(o.creadaEn),
          vigenciaHoras: Math.max(1, Math.round((o.venceEn.getTime() - o.creadaEn.getTime()) / 3_600_000)),
          estado: o.estado as "activa" | "contraofertada" | "aceptada" | "expirada",
        })),
      },
      perspectivaFija: null,
    };
  });
}

// ─── Chat (conversación de la negociación/reserva en curso) ─────────────────

export function datosChat(): Promise<DatosChat> {
  return resolverPanel("principal", demoChat, async (db, u) => {
    // Misma conversación que el módulo de negociación: la solicitud aceptada
    // más reciente donde participa el usuario del panel.
    const [ctx] = await db
      .select({
        solicitudId: solicitudes.id,
        propiedadId: solicitudes.propiedadId,
        externoId: solicitudes.externoId,
        principalId: solicitudes.principalAceptanteId,
      })
      .from(solicitudes)
      .where(
        and(
          sql`${solicitudes.estado} = 'aceptada'`,
          sql`(${solicitudes.principalAceptanteId} = ${u.id} OR ${solicitudes.externoId} = ${u.id})`,
        ),
      )
      .orderBy(desc(solicitudes.creadaEn))
      .limit(1);
    if (!ctx || !ctx.principalId) {
      return { ...demoChat(), esDemo: false, solicitudId: null, mensajes: [], contexto: "Sin conversaciones activas" };
    }

    const [prop] = await db
      .select({ nombre: propiedades.nombre })
      .from(propiedades)
      .where(eq(propiedades.id, ctx.propiedadId));
    const [res] = await db
      .select({ codigo: reservas.codigo })
      .from(reservas)
      .where(eq(reservas.solicitudId, ctx.solicitudId));
    const alias = await aliasDe(db, [ctx.principalId, ctx.externoId]);

    const filas = await db
      .select()
      .from(mensajesChat)
      .where(eq(mensajesChat.solicitudId, ctx.solicitudId))
      .orderBy(asc(mensajesChat.enviadoEn))
      .limit(200);

    const strikesDe = async (id: string) => {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(intentosFuga)
        .where(and(eq(intentosFuga.usuarioId, id), eq(intentosFuga.accion, "bloqueado")));
      return n;
    };

    return {
      esDemo: false,
      solicitudId: ctx.solicitudId,
      contexto: `${res?.codigo ?? "Negociación"} · ${prop?.nombre ?? ""}`,
      aliasPrincipal: alias.get(ctx.principalId) ?? "—",
      aliasExterno: alias.get(ctx.externoId) ?? "—",
      mensajes: filas.map((f) => ({
        id: f.id,
        emisorRol: f.emisorId === ctx.externoId ? ("externo" as const) : ("principal" as const),
        texto: f.contenido,
        bloqueado: f.bloqueado,
        motivos: (f.flags as string[]) ?? [],
      })),
      strikes: {
        principal: await strikesDe(ctx.principalId),
        externo: await strikesDe(ctx.externoId),
      },
    };
  });
}

// ─── Ficha de propiedad (externo) ────────────────────────────────────────────

export function datosFicha(id: string, mesPedido?: string): Promise<DatosFicha | null> {
  return resolverPanel("externo", () => demoFicha(), async (db) => {
    const [fila] = await db.select().from(propiedades).where(eq(propiedades.id, id)).limit(1);
    if (!fila || !fila.publicada) return null;
    const [prop] = await propiedadesUI(db, [fila]);

    const mesIso = clamparMes(mesPedido, hoyEnBogota().slice(0, 7));
    const dias = await db
      .select({ fecha: calendarioDias.fecha })
      .from(calendarioDias)
      .where(
        and(
          eq(calendarioDias.propiedadId, id),
          sql`to_char(${calendarioDias.fecha}::date, 'YYYY-MM') = ${mesIso}`,
          sql`${calendarioDias.estado} <> 'disponible'`,
        ),
      );

    const info = infoMes(mesIso);
    return {
      propiedad: prop,
      esDemo: false,
      mesIso,
      mesTitulo: info.titulo,
      diasDelMes: info.dias,
      offsetLunes: info.offsetLunes,
      ocupados: dias.map((d) => Number(d.fecha.slice(8, 10))),
    };
  });
}
