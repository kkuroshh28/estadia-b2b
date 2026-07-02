/**
 * Tests de integración contra Postgres REAL (dev/staging — jamás prod).
 * Se saltan si no hay DATABASE_URL; en CI corren contra la DB de test.
 *
 * Prueban las DOS reglas críticas de concurrencia del negocio:
 *  1. "El primero que paga, gana" — carrera de dos webhooks por las mismas fechas.
 *  2. "El primero que acepta, gana" — N aceptaciones simultáneas.
 * Más: idempotencia de webhooks y unicidad de alias bajo concurrencia.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  calendarioDias,
  linksDePago,
  propiedades,
  reservas,
  solicitudes,
  splits,
  usuarios,
} from "../db/schema";
import { procesarWebhookPago } from "./pagos";
import { aceptarSolicitud } from "./reservas";
import { asignarAliasUnico } from "./alias";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("integración — concurrencia financiera", () => {
  let db: Db;
  let propietarioId: string;
  let principalId: string;
  let externoId: string;
  let propiedadId: string;

  const crearUsuario = async (rol: "propietario" | "principal" | "externo", n: number) => {
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: `Test ${rol} ${n}`,
        cedulaHash: `hash-${rol}-${n}-${Date.now()}-${Math.random()}`,
        cedulaCifrada: "x",
        email: `test-${rol}-${n}-${Date.now()}-${Math.random()}@test.local`,
        telefonoCifrado: "x",
        roles: [rol],
        estado: "activo",
      })
      .returning({ id: usuarios.id });
    return u.id;
  };

  beforeAll(async () => {
    db = obtenerDb();
    propietarioId = await crearUsuario("propietario", 1);
    principalId = await crearUsuario("principal", 1);
    externoId = await crearUsuario("externo", 1);

    const [p] = await db
      .insert(propiedades)
      .values({
        propietarioId,
        nombre: "Finca Test Concurrencia",
        municipio: "Guatapé",
        zona: "Oriente",
        tipo: "finca",
        capacidad: 10,
        habitaciones: 4,
        banos: 3,
      })
      .returning({ id: propiedades.id });
    propiedadId = p.id;

    // Calendario agosto: días 10-13 disponibles
    for (let d = 10; d <= 13; d++) {
      await db.insert(calendarioDias).values({
        propiedadId,
        fecha: `2026-08-${d}`,
        estado: "disponible",
      });
    }
  });

  afterAll(async () => {
    // Los datos de test quedan en la DB de dev con marcas "Test" — la DB de
    // test/staging se resetea por script, nunca a mano.
  });

  const crearReservaConLink = async (sufijo: string) => {
    const [s] = await db
      .insert(solicitudes)
      .values({
        externoId,
        propiedadId,
        desde: "2026-08-10",
        hasta: "2026-08-12",
        huespedes: 6,
        estado: "aceptada",
        principalAceptanteId: principalId,
        venceEn: sql`now() + interval '1 hour'` as unknown as Date,
      })
      .returning({ id: solicitudes.id });

    const [r] = await db
      .insert(reservas)
      .values({
        codigo: `EST-TEST-${sufijo}-${Date.now()}`,
        solicitudId: s.id,
        propiedadId,
        principalId,
        externoId,
        desde: "2026-08-10",
        hasta: "2026-08-12",
        estado: "LINK_1_ENVIADO",
        precioFinalCentavos: 510_000_000, // $5.100.000
        tarifaNetaCentavos: 435_000_000, // $4.350.000
      })
      .returning({ id: reservas.id });

    const [l] = await db
      .insert(linksDePago)
      .values({
        reservaId: r.id,
        mitad: 1,
        montoCentavos: 255_000_000,
        url: `https://pago.test/${sufijo}-${Date.now()}`,
        venceEn: sql`now() + interval '1 day'` as unknown as Date,
      })
      .returning({ id: linksDePago.id });

    return { reservaId: r.id, linkId: l.id };
  };

  it("carrera de pagos: dos webhooks por las MISMAS fechas — exactamente uno gana", async () => {
    const a = await crearReservaConLink("A");
    const b = await crearReservaConLink("B");

    const [ra, rb] = await Promise.all([
      procesarWebhookPago(db, {
        pasarelaRef: `evt-A-${Date.now()}`,
        linkId: a.linkId,
        montoCentavos: 255_000_000,
        estado: "aprobada",
      }),
      procesarWebhookPago(db, {
        pasarelaRef: `evt-B-${Date.now()}`,
        linkId: b.linkId,
        montoCentavos: 255_000_000,
        estado: "aprobada",
      }),
    ]);

    // Exactamente UNO procesa; el otro muere sin split por cualquiera de los
    // dos caminos válidos: pierde la carrera del calendario (fechas_tomadas)
    // o el ganador ya invalidó su link antes de su lock (link_no_activo).
    const resultados = [ra.resultado, rb.resultado];
    expect(resultados.filter((r) => r === "procesado")).toHaveLength(1);
    expect(
      resultados.filter((r) => r === "fechas_tomadas" || r === "link_no_activo"),
    ).toHaveLength(1);

    // El perdedor quedó INVALIDADO y sin transacción/split
    const perdedor = ra.resultado === "procesado" ? b : a;
    const [linkPerdedor] = await db
      .select()
      .from(linksDePago)
      .where(sql`id = ${perdedor.linkId}`);
    expect(linkPerdedor.estado).toBe("invalidado");

    // Los días quedaron bloqueados por el ganador
    const dias = await db
      .select()
      .from(calendarioDias)
      .where(sql`propiedad_id = ${propiedadId} AND fecha BETWEEN '2026-08-10' AND '2026-08-12'`);
    for (const d of dias) expect(d.estado).toBe("reservado_app");
  }, 30_000);

  it("idempotencia: el MISMO webhook dos veces jamás duplica un split", async () => {
    // Reserva en otras fechas para no chocar con el test anterior
    await db.insert(calendarioDias).values({ propiedadId, fecha: "2026-08-20", estado: "disponible" });
    const [s] = await db
      .insert(solicitudes)
      .values({
        externoId, propiedadId, desde: "2026-08-20", hasta: "2026-08-20",
        huespedes: 2, estado: "aceptada", principalAceptanteId: principalId,
        venceEn: sql`now() + interval '1 hour'` as unknown as Date,
      })
      .returning({ id: solicitudes.id });
    const [r] = await db
      .insert(reservas)
      .values({
        codigo: `EST-TEST-IDEM-${Date.now()}`, solicitudId: s.id, propiedadId,
        principalId, externoId, desde: "2026-08-20", hasta: "2026-08-20",
        estado: "LINK_1_ENVIADO",
        precioFinalCentavos: 100_000_000, tarifaNetaCentavos: 80_000_000,
      })
      .returning({ id: reservas.id });
    const [l] = await db
      .insert(linksDePago)
      .values({
        reservaId: r.id, mitad: 1, montoCentavos: 50_000_000,
        url: `https://pago.test/idem-${Date.now()}`,
        venceEn: sql`now() + interval '1 day'` as unknown as Date,
      })
      .returning({ id: linksDePago.id });

    const ref = `evt-IDEM-${Date.now()}`;
    const evento = { pasarelaRef: ref, linkId: l.id, montoCentavos: 50_000_000, estado: "aprobada" as const };

    const r1 = await procesarWebhookPago(db, evento);
    const r2 = await procesarWebhookPago(db, evento); // duplicado exacto

    expect(r1.resultado).toBe("procesado");
    expect(r2.resultado).toBe("duplicado");

    const filas = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(splits)
      .where(sql`transaccion_id IN (SELECT id FROM transacciones WHERE pasarela_ref = ${ref})`);
    expect(filas[0].n).toBe(4); // exactamente un juego de 4 splits, no 8
  }, 30_000);

  it("el primero que ACEPTA gana: 8 aceptaciones simultáneas, exactamente 1 exitosa", async () => {
    const [s] = await db
      .insert(solicitudes)
      .values({
        externoId, propiedadId, desde: "2026-08-25", hasta: "2026-08-27",
        huespedes: 4, estado: "pendiente",
        venceEn: sql`now() + interval '1 hour'` as unknown as Date,
      })
      .returning({ id: solicitudes.id });

    const principales = await Promise.all(
      Array.from({ length: 8 }, (_, i) => crearUsuario("principal", 100 + i)),
    );
    const resultados = await Promise.all(
      principales.map((pid) => aceptarSolicitud(db, s.id, pid)),
    );

    expect(resultados.filter(Boolean)).toHaveLength(1);
  }, 30_000);

  it("alias: 40 asignaciones concurrentes, todas únicas", async () => {
    const ids = await Promise.all(
      Array.from({ length: 40 }, (_, i) => crearUsuario("externo", 200 + i)),
    );
    const aliases = await Promise.all(ids.map((id) => asignarAliasUnico(db, id)));
    expect(new Set(aliases).size).toBe(aliases.length);
  }, 30_000);
});
