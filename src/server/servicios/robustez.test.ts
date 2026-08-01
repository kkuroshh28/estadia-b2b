/**
 * Tests de ROBUSTEZ — blindan los fixes de la auditoría fría:
 *  - back-to-back: una entrada el día que otra sale NO choca (noches semiabiertas).
 *  - compensación: un cobro aprobado sobre link vencido/invalidado se registra,
 *    jamás se pierde en silencio.
 *  - reembolso ÍNTEGRO por reserva: devuelve TODAS las mitades aprobadas.
 *  - tarifa neta noche-a-noche cruzando temporadas.
 * Contra Postgres real.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  compensaciones,
  linksDePago,
  negociaciones,
  propiedades,
  reservas,
  splits,
  tarifas,
  transacciones,
  usuarios,
} from "../db/schema";
import { crearPropiedad } from "./propiedades";
import { aceptarOferta, aceptarYAbrirNegociacion, contraofertar, crearSolicitud } from "./solicitudes";
import { generarLinkSaldo, procesarWebhookPago, transicionPostPago } from "./pagos";
import { reembolsar } from "./admin";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("robustez — fixes de la auditoría", () => {
  let db: Db;
  let duenoId: string;
  // socioComercialId reservado para escenarios de no-pertenencia
  let socioVentasId: string;
  let adminId: string;

  const crearUsuario = async (rol: "propietario" | "principal" | "externo" | "admin") => {
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: `RB ${rol}`,
        cedulaHash: `rb-${rol}-${Date.now()}-${Math.random()}`,
        cedulaCifrada: "x",
        email: `rb-${rol}-${Date.now()}-${Math.random()}@test.local`,
        telefonoCifrado: "x",
        roles: [rol],
        estado: "activo",
      })
      .returning({ id: usuarios.id });
    return u.id;
  };

  const nuevaPropiedad = async (owner: string, neta: number) => {
    const r = await crearPropiedad(db, owner, {
      nombre: `RB Casa ${Date.now()}-${Math.random()}`,
      municipio: "Guatapé",
      zona: "Oriente",
      tipo: "casa",
      capacidad: 6,
      habitaciones: 3,
      banos: 2,
      amenidades: [],
      reglas: [],
      tarifaNetaNochePesos: neta,
      publicada: true,
      ownerDirect: true,
    });
    await db.update(propiedades).set({ verificada: true }).where(eq(propiedades.id, r.propiedadId));
    return r.propiedadId;
  };

  const cerrarReserva = async (
    propiedadId: string,
    desde: string,
    hasta: string,
    precioPesos: number,
  ) => {
    const { solicitudId } = await crearSolicitud(db, {
      externoId: socioVentasId,
      propiedadId,
      desde,
      hasta,
      huespedes: 2,
    });
    const acept = await aceptarYAbrirNegociacion(db, solicitudId, duenoId);
    const { ofertaId } = await contraofertar(db, acept.negociacionId!, socioVentasId, precioPesos * 100);
    return await aceptarOferta(db, ofertaId, duenoId);
  };

  beforeAll(async () => {
    db = obtenerDb();
    duenoId = await crearUsuario("propietario");
    socioVentasId = await crearUsuario("externo");
    adminId = await crearUsuario("admin");
  });

  it("BACK-TO-BACK: entrar el día que otro sale NO choca (noches semiabiertas)", async () => {
    const propiedadId = await nuevaPropiedad(duenoId, 500_000);
    // Reserva A: 15→18 (noches 15,16,17). Pago 1 → bloquea esas noches.
    const a = await cerrarReserva(propiedadId, "2027-03-15", "2027-03-18", 2_400_000); // neta 1.5M
    const pa = await procesarWebhookPago(db, {
      pasarelaRef: `rb-a-${Date.now()}`,
      linkId: a.linkId,
      montoCentavos: a.montoCentavos,
      estado: "aprobada",
    });
    expect(pa.resultado).toBe("procesado");

    // Reserva B: 18→20 — entra el día que A sale. Debe ganar, no chocar.
    const b = await cerrarReserva(propiedadId, "2027-03-18", "2027-03-20", 1_400_000); // neta 1.0M
    const pb = await procesarWebhookPago(db, {
      pasarelaRef: `rb-b-${Date.now()}`,
      linkId: b.linkId,
      montoCentavos: b.montoCentavos,
      estado: "aprobada",
    });
    expect(pb.resultado).toBe("procesado");
  });

  it("COMPENSACIÓN: cobro aprobado sobre link vencido se registra, no se pierde", async () => {
    const propiedadId = await nuevaPropiedad(duenoId, 400_000);
    const r = await cerrarReserva(propiedadId, "2027-04-10", "2027-04-12", 1_200_000); // neta 800k
    // Forzar vencimiento del link.
    await db
      .update(linksDePago)
      .set({ venceEn: sql`now() - interval '1 hour'` })
      .where(eq(linksDePago.id, r.linkId));

    const ref = `rb-venc-${Date.now()}`;
    const res = await procesarWebhookPago(db, {
      pasarelaRef: ref,
      linkId: r.linkId,
      montoCentavos: r.montoCentavos,
      estado: "aprobada",
    });
    expect(res.resultado).toBe("link_no_activo");

    const [comp] = await db.select().from(compensaciones).where(eq(compensaciones.pasarelaRef, ref));
    expect(comp).toBeTruthy();
    expect(comp.motivo).toBe("link_vencido");
    expect(Number(comp.montoCentavos)).toBe(r.montoCentavos);
    expect(comp.estado).toBe("pendiente");
  });

  it("REEMBOLSO ÍNTEGRO: devuelve AMBAS mitades de una reserva en PAGO_COMPLETO", async () => {
    const propiedadId = await nuevaPropiedad(duenoId, 1_000_000);
    const r = await cerrarReserva(propiedadId, "2027-05-01", "2027-05-03", 2_000_000);
    // Pago 1
    await procesarWebhookPago(db, {
      pasarelaRef: `rb-m1-${Date.now()}`,
      linkId: r.linkId,
      montoCentavos: r.montoCentavos,
      estado: "aprobada",
    });
    await transicionPostPago(db, r.reservaId, 1);
    // Pago 2
    const saldo = await generarLinkSaldo(db, r.reservaId, socioVentasId);
    await procesarWebhookPago(db, {
      pasarelaRef: `rb-m2-${Date.now()}`,
      linkId: saldo.linkId,
      montoCentavos: saldo.montoCentavos,
      estado: "aprobada",
    });
    await transicionPostPago(db, r.reservaId, 2);

    // Reembolsar UNA transacción debe reversar la reserva ENTERA (2 mitades).
    const trxs = await db
      .select({ id: transacciones.id })
      .from(transacciones)
      .innerJoin(linksDePago, eq(linksDePago.id, transacciones.linkId))
      .where(eq(linksDePago.reservaId, r.reservaId));
    expect(trxs.length).toBe(2);

    await reembolsar(
      db,
      { id: adminId, email: "a@t", roles: ["admin"], estado: "activo", adminElevada: true } as never,
      trxs[0].id,
      "CONFIRMO REEMBOLSO",
    );

    const filas = await db
      .select({ estado: transacciones.estado })
      .from(transacciones)
      .innerJoin(linksDePago, eq(linksDePago.id, transacciones.linkId))
      .where(eq(linksDePago.reservaId, r.reservaId));
    // AMBAS reversadas — jamás se retiene una mitad al cliente.
    expect(filas.every((f) => f.estado === "reversada")).toBe(true);

    const [res] = await db.select().from(reservas).where(eq(reservas.id, r.reservaId));
    expect(res.estado).toBe("CANCELADA");

    // Conciliación en cero: suma de todos los splits de la reserva = 0.
    const suma = await db
      .select({ total: sql<number>`coalesce(sum(${splits.montoCentavos}),0)::bigint` })
      .from(splits)
      .innerJoin(transacciones, eq(transacciones.id, splits.transaccionId))
      .innerJoin(linksDePago, eq(linksDePago.id, transacciones.linkId))
      .where(eq(linksDePago.reservaId, r.reservaId));
    expect(Number(suma[0].total)).toBe(0);
  });

  it("TARIFA NOCHE-A-NOCHE: cruzar dos temporadas cobra cada noche a su tarifa", async () => {
    const propiedadId = await nuevaPropiedad(duenoId, 300_000);
    // La creación abre vigencia [hoy, 2099] a 300k. Le agrego una segunda
    // temporada partiendo el rango: 2027-06-03..2027-06-30 a 500k.
    await db
      .update(tarifas)
      .set({ hasta: "2027-06-02" })
      .where(eq(tarifas.propiedadId, propiedadId));
    await db.insert(tarifas).values({
      propiedadId,
      desde: "2027-06-03",
      hasta: "2027-12-31",
      netaNocheCentavos: 500_000_00,
    });

    // Estadía 2027-06-01 → 2027-06-05: noches 1,2 (300k) + 3,4 (500k) = 1.600.000
    const { solicitudId } = await crearSolicitud(db, {
      externoId: socioVentasId,
      propiedadId,
      desde: "2027-06-01",
      hasta: "2027-06-05",
      huespedes: 2,
    });
    const acept = await aceptarYAbrirNegociacion(db, solicitudId, duenoId);
    const [neg] = await db.select().from(negociaciones).where(eq(negociaciones.id, acept.negociacionId!));
    expect(Number(neg.tarifaNetaCentavos)).toBe(1_600_000_00);
  });
});
