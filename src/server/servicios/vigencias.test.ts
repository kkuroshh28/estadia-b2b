/**
 * Vigencias DURAS: lo vencido no mueve dinero aunque el cron no haya pasado,
 * y el cron deja la verdad marcada en la DB.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  linksDePago,
  negociaciones,
  ofertas,
  propiedades,
  reservas,
  solicitudes,
  usuarios,
} from "../db/schema";
import { generarLinkSaldo, procesarWebhookPago } from "./pagos";
import { aceptarOfertaYGenerarLink, OfertaNoAceptableError } from "./negociacion";
import { expirarVigencias } from "./vigencias";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("vigencias — lo vencido no opera", () => {
  let db: Db;
  let duenoId: string;
  let principalId: string;
  let externoId: string;
  let propiedadId: string;

  const crearUsuario = async (rol: "propietario" | "principal" | "externo") => {
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: `Vig ${rol}`,
        cedulaHash: `vig-${rol}-${Date.now()}-${Math.random()}`,
        cedulaCifrada: "x",
        email: `vig-${rol}-${Date.now()}-${Math.random()}@test.local`,
        telefonoCifrado: "x",
        roles: [rol],
        estado: "activo",
      })
      .returning({ id: usuarios.id });
    return u.id;
  };

  const crearReservaConLink = async (sufijo: string, venceLink: string) => {
    const [sol] = await db
      .insert(solicitudes)
      .values({
        externoId,
        propiedadId,
        desde: "2027-05-10",
        hasta: "2027-05-12",
        huespedes: 2,
        estado: "aceptada",
        principalAceptanteId: principalId,
        venceEn: sql`now() + interval '1 day'` as unknown as Date,
      })
      .returning({ id: solicitudes.id });
    const [res] = await db
      .insert(reservas)
      .values({
        codigo: `CIR-VIG-${sufijo}-${Date.now()}`,
        solicitudId: sol.id,
        propiedadId,
        principalId,
        externoId,
        desde: "2027-05-10",
        hasta: "2027-05-12",
        estado: "LINK_1_ENVIADO",
        precioFinalCentavos: 200_000_000,
        tarifaNetaCentavos: 160_000_000,
      })
      .returning({ id: reservas.id });
    const [lnk] = await db
      .insert(linksDePago)
      .values({
        reservaId: res.id,
        mitad: 1,
        montoCentavos: 100_000_000,
        url: `/pago/vig-${sufijo}-${Date.now()}`,
        venceEn: sql.raw(`${venceLink}`) as unknown as Date,
      })
      .returning({ id: linksDePago.id });
    return { reservaId: res.id, linkId: lnk.id, solicitudId: sol.id };
  };

  beforeAll(async () => {
    db = obtenerDb();
    duenoId = await crearUsuario("propietario");
    principalId = await crearUsuario("principal");
    externoId = await crearUsuario("externo");
    const [p] = await db
      .insert(propiedades)
      .values({
        propietarioId: duenoId,
        nombre: `Finca Vig ${Date.now()}`,
        municipio: "Guatapé",
        zona: "Oriente",
        tipo: "finca",
        capacidad: 6,
        habitaciones: 2,
        banos: 2,
        publicada: true,
      })
      .returning({ id: propiedades.id });
    propiedadId = p.id;
  });

  it("un link VENCIDO no se cobra: el webhook lo marca expirado sin mover un peso", async () => {
    const { linkId } = await crearReservaConLink("l1", "now() - interval '1 hour'");
    const r = await procesarWebhookPago(db, {
      pasarelaRef: `vig-evt-${Date.now()}`,
      linkId,
      montoCentavos: 100_000_000,
      estado: "aprobada",
    });
    expect(r.resultado).toBe("link_no_activo");
    const [l] = await db.select().from(linksDePago).where(eq(linksDePago.id, linkId));
    expect(l.estado).toBe("expirado");
  });

  it("una oferta VENCIDA no se acepta (y queda marcada expirada)", async () => {
    const { solicitudId } = await crearReservaConLink("of", "now() + interval '1 day'");
    const [neg] = await db
      .insert(negociaciones)
      .values({ solicitudId, tarifaNetaCentavos: 160_000_000 })
      .returning({ id: negociaciones.id });
    const [of] = await db
      .insert(ofertas)
      .values({
        negociacionId: neg.id,
        emisorId: externoId,
        montoCentavos: 200_000_000,
        estado: "activa",
        venceEn: sql`now() - interval '1 minute'` as unknown as Date,
      })
      .returning({ id: ofertas.id });

    await expect(aceptarOfertaYGenerarLink(db, of.id, principalId)).rejects.toThrow(
      OfertaNoAceptableError,
    );
    const [ofDb] = await db.select().from(ofertas).where(eq(ofertas.id, of.id));
    expect(ofDb.estado).toBe("expirada");
  });

  it("el cron expira solicitudes/links y la reserva del link 1 vencido EXPIRA auditada", async () => {
    const { reservaId } = await crearReservaConLink("cron", "now() - interval '2 hours'");
    await db.insert(solicitudes).values({
      externoId,
      propiedadId,
      desde: "2027-06-01",
      hasta: "2027-06-03",
      huespedes: 2,
      estado: "pendiente",
      venceEn: sql`now() - interval '5 minutes'` as unknown as Date,
    });

    const r = await expirarVigencias(db);
    expect(r.solicitudes).toBeGreaterThanOrEqual(1);
    expect(r.links).toBeGreaterThanOrEqual(1);
    expect(r.reservasExpiradas).toBeGreaterThanOrEqual(1);

    const [res] = await db.select().from(reservas).where(eq(reservas.id, reservaId));
    expect(res.estado).toBe("EXPIRADA");
  });

  it("el link del saldo expirado se REGENERA con nueva vigencia (misma fila)", async () => {
    const { reservaId } = await crearReservaConLink("s2", "now() + interval '1 day'");
    await db.update(reservas).set({ estado: "ANTICIPO_PAGADO" }).where(eq(reservas.id, reservaId));

    const s1 = await generarLinkSaldo(db, reservaId, externoId);
    // Simular el paso del tiempo: el link 2 vence y el cron lo marca.
    await db
      .update(linksDePago)
      .set({ venceEn: sql`now() - interval '1 hour'` })
      .where(eq(linksDePago.id, s1.linkId));
    await expirarVigencias(db);
    const [expirado] = await db.select().from(linksDePago).where(eq(linksDePago.id, s1.linkId));
    expect(expirado.estado).toBe("expirado");

    const s2 = await generarLinkSaldo(db, reservaId, externoId);
    expect(s2.linkId).toBe(s1.linkId); // misma fila, regenerada
    const [vivo] = await db
      .select()
      .from(linksDePago)
      .where(and(eq(linksDePago.id, s1.linkId), eq(linksDePago.estado, "activo")));
    expect(vivo).toBeTruthy();
  });
});
