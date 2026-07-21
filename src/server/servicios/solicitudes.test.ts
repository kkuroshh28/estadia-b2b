/**
 * Ciclo operativo real: solicitud → aceptación (primero gana) → negociación
 * (turnos, piso) → oferta aceptada → link del motor. Contra Postgres real.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  linksDePago,
  ofertas,
  propiedades,
  reservas,
  suscripciones,
  tarifas,
  usuarios,
  vinculosComisionista,
} from "../db/schema";
import {
  aceptarOferta,
  aceptarYAbrirNegociacion,
  contraofertar,
  crearSolicitud,
  OperacionError,
} from "./solicitudes";
import { procesarWebhookPago } from "./pagos";
import { calendarioDias } from "../db/schema";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("operación — solicitud a link, reglas en servidor", () => {
  let db: Db;
  let duenoId: string;
  let principalId: string;
  let principal2Id: string;
  let externoId: string;
  let propiedadId: string;
  let sinSuscripcionId: string;

  const crearUsuario = async (rol: "propietario" | "principal" | "externo", n: string) => {
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: `Op ${rol} ${n}`,
        cedulaHash: `op-${rol}-${n}-${Date.now()}-${Math.random()}`,
        cedulaCifrada: "x",
        email: `op-${rol}-${n}-${Date.now()}-${Math.random()}@test.local`,
        telefonoCifrado: "x",
        roles: [rol],
        estado: "activo",
      })
      .returning({ id: usuarios.id });
    return u.id;
  };

  const crearPropiedad = async (propietarioId: string) => {
    const [p] = await db
      .insert(propiedades)
      .values({
        propietarioId,
        nombre: `Finca Op ${Date.now()}-${Math.random()}`,
        municipio: "Guatapé",
        zona: "Oriente",
        tipo: "finca",
        capacidad: 8,
        habitaciones: 3,
        banos: 2,
        publicada: true,
        verificada: true,
      })
      .returning({ id: propiedades.id });
    await db.insert(tarifas).values({
      propiedadId: p.id,
      desde: "2026-01-01",
      hasta: "2027-12-31",
      netaNocheCentavos: 100_000_000, // $1.000.000/noche
    });
    return p.id;
  };

  beforeAll(async () => {
    db = obtenerDb();
    duenoId = await crearUsuario("propietario", "d");
    principalId = await crearUsuario("principal", "p1");
    principal2Id = await crearUsuario("principal", "p2");
    externoId = await crearUsuario("externo", "e");
    propiedadId = await crearPropiedad(duenoId);
    await db.insert(suscripciones).values({
      propietarioId: duenoId,
      plan: "piloto",
      estado: "activa",
      renuevaEn: "2027-01-01",
    });
    for (const pid of [principalId, principal2Id]) {
      await db.insert(vinculosComisionista).values({ propiedadId, principalId: pid });
    }
    // Propietario SIN suscripción activa (regla #3)
    sinSuscripcionId = await crearPropiedad(await crearUsuario("propietario", "d2"));
  });

  it("rechaza solicitudes inválidas: 93 noches, sobre-capacidad, sin suscripción", async () => {
    const base = { externoId, propiedadId, huespedes: 4 };
    await expect(
      crearSolicitud(db, { ...base, desde: "2026-09-01", hasta: "2026-12-03" }),
    ).rejects.toThrow(OperacionError); // 93 noches
    await expect(
      crearSolicitud(db, { ...base, desde: "2026-09-01", hasta: "2026-09-04", huespedes: 20 }),
    ).rejects.toThrow(/máximo 8/);
    await expect(
      crearSolicitud(db, {
        externoId,
        propiedadId: sinSuscripcionId,
        desde: "2026-09-01",
        hasta: "2026-09-04",
        huespedes: 2,
      }),
    ).rejects.toThrow(/suscripción/);
  });

  it("ciclo completo: solicitud → primero gana → negociación por turnos → link del motor", async () => {
    const { solicitudId } = await crearSolicitud(db, {
      externoId,
      propiedadId,
      desde: "2026-09-10",
      hasta: "2026-09-13", // 3 noches → neta $3.000.000
      huespedes: 6,
    });

    // Un principal NO vinculado no puede aceptar
    const intruso = await crearUsuario("principal", "px");
    await expect(aceptarYAbrirNegociacion(db, solicitudId, intruso)).rejects.toThrow(/vinculado/);

    // Carrera: los dos vinculados intentan — exactamente uno gana
    const [r1, r2] = await Promise.all([
      aceptarYAbrirNegociacion(db, solicitudId, principalId),
      aceptarYAbrirNegociacion(db, solicitudId, principal2Id),
    ]);
    expect([r1.gano, r2.gano].filter(Boolean)).toHaveLength(1);
    const ganador = r1.gano ? { ...r1, id: principalId } : { ...r2, id: principal2Id };
    const negociacionId = ganador.negociacionId!;

    const [res] = await db.select().from(reservas).where(eq(reservas.id, ganador.reservaId!));
    expect(res.estado).toBe("NEGOCIACION");
    expect(res.tarifaNetaCentavos).toBe(300_000_000);

    // El precio no puede bajar de la neta (regla #5)
    await expect(contraofertar(db, negociacionId, externoId, 250_000_000)).rejects.toThrow(
      /tarifa neta/,
    );

    // Externo ofrece $3.400.000 → turno del principal (no puede ofertar dos veces)
    await contraofertar(db, negociacionId, externoId, 340_000_000);
    await expect(contraofertar(db, negociacionId, externoId, 350_000_000)).rejects.toThrow(/turno/);

    // Principal contraoferta $3.600.000 → la anterior queda contraofertada
    const { ofertaId } = await contraofertar(db, negociacionId, ganador.id, 360_000_000);
    const todas = await db.select().from(ofertas).where(eq(ofertas.negociacionId, negociacionId));
    expect(todas.filter((o) => o.estado === "activa")).toHaveLength(1);

    // Un tercero no puede ofertar
    await expect(contraofertar(db, negociacionId, intruso, 380_000_000)).rejects.toThrow(/parte/);

    // El externo acepta la oferta del principal → link EXACTO del motor
    const { linkId, montoCentavos, reservaId } = await aceptarOferta(db, ofertaId, externoId);
    expect(montoCentavos).toBe(180_000_000); // mitad de $3.600.000

    const [link] = await db.select().from(linksDePago).where(eq(linksDePago.id, linkId));
    expect(link.mitad).toBe(1);
    const [resFinal] = await db.select().from(reservas).where(eq(reservas.id, reservaId));
    expect(resFinal.estado).toBe("LINK_1_ENVIADO");
    expect(resFinal.precioFinalCentavos).toBe(360_000_000);

    // Pago 1 sobre fechas SIN filas de calendario: el webhook debe
    // materializarlas y bloquearlas (sin esto, una segunda venta se colaría).
    const r = await procesarWebhookPago(db, {
      pasarelaRef: `op-pago-${Date.now()}`,
      linkId,
      montoCentavos: 180_000_000,
      estado: "aprobada",
    });
    expect(r.resultado).toBe("procesado");
    const dias = await db
      .select()
      .from(calendarioDias)
      .where(eq(calendarioDias.propiedadId, propiedadId));
    const bloqueados = dias.filter(
      (d) => d.fecha >= "2026-09-10" && d.fecha <= "2026-09-13" && d.estado === "reservado_app",
    );
    expect(bloqueados).toHaveLength(4); // 10, 11, 12 y 13 (incluye salida)
  });
});
