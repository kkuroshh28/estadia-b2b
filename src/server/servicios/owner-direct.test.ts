/**
 * Anexo I — Owner Direct: el dueño gestiona directo, negocia en el Deal Room
 * y recibe TAMBIÉN la participación comercial del split. El margen mínimo
 * define el precio mínimo de venta. Contra Postgres real.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import { propiedades, reservas, splits, transacciones, usuarios } from "../db/schema";
import { crearPropiedad, editarPropiedad, PropiedadError } from "./propiedades";
import {
  aceptarOferta,
  aceptarYAbrirNegociacion,
  contraofertar,
  crearSolicitud,
  OperacionError,
} from "./solicitudes";
import { procesarWebhookPago, transicionPostPago } from "./pagos";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("Owner Direct — gestión directa del dueño", () => {
  let db: Db;
  let duenoId: string;
  let socioComercialId: string;
  let socioVentasId: string;
  let propiedadId: string;

  const crearUsuario = async (rol: "propietario" | "principal" | "externo") => {
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: `OD ${rol}`,
        cedulaHash: `od-${rol}-${Date.now()}-${Math.random()}`,
        cedulaCifrada: "x",
        email: `od-${rol}-${Date.now()}-${Math.random()}@test.local`,
        telefonoCifrado: "x",
        roles: [rol],
        estado: "activo",
      })
      .returning({ id: usuarios.id });
    return u.id;
  };

  beforeAll(async () => {
    db = obtenerDb();
    duenoId = await crearUsuario("propietario");
    socioComercialId = await crearUsuario("principal");
    socioVentasId = await crearUsuario("externo");

    // Alta REAL con gestión directa + margen mínimo de $800.000.
    const r = await crearPropiedad(db, duenoId, {
      nombre: `Casa OD ${Date.now()}`,
      municipio: "Guatapé",
      zona: "Oriente",
      tipo: "casa",
      capacidad: 8,
      habitaciones: 3,
      banos: 2,
      amenidades: ["Piscina"],
      reglas: [],
      tarifaNetaNochePesos: 1_000_000,
      publicada: true,
      ownerDirect: true,
      margenMinimoPesos: 800_000,
    });
    propiedadId = r.propiedadId;
    await db.update(propiedades).set({ verificada: true }).where(eq(propiedades.id, propiedadId));
  });

  it("ciclo completo: solo el dueño acepta, el margen mínimo rige y el split le paga la parte comercial", async () => {
    const { solicitudId } = await crearSolicitud(db, {
      externoId: socioVentasId,
      propiedadId,
      desde: "2026-10-10",
      hasta: "2026-10-15", // 5 noches → neta $5.000.000, mínimo $5.800.000
      huespedes: 6,
    });

    // Un socio comercial ajeno NO puede aceptar una propiedad de gestión directa.
    await expect(aceptarYAbrirNegociacion(db, solicitudId, socioComercialId)).rejects.toThrow(
      /gestión directa/,
    );

    // El DUEÑO acepta sin necesidad de vínculo.
    const acept = await aceptarYAbrirNegociacion(db, solicitudId, duenoId);
    expect(acept.gano).toBe(true);
    const negociacionId = acept.negociacionId!;

    // Oferta por debajo del precio mínimo de venta (neta + margen) → rechazada.
    await expect(contraofertar(db, negociacionId, socioVentasId, 5_500_000_00)).rejects.toThrow(
      /precio mínimo de venta/,
    );

    // Oferta válida del socio de ventas: $6.000.000. El dueño la acepta.
    const { ofertaId } = await contraofertar(db, negociacionId, socioVentasId, 6_000_000_00);
    const { linkId, montoCentavos, reservaId } = await aceptarOferta(db, ofertaId, duenoId);
    expect(montoCentavos).toBe(3_000_000_00); // mitad exacta

    // Pago 1 por el webhook real.
    const pago = await procesarWebhookPago(db, {
      pasarelaRef: `od-evt-${Date.now()}`,
      linkId,
      montoCentavos: 3_000_000_00,
      estado: "aprobada",
    });
    expect(pago.resultado).toBe("procesado");
    await transicionPostPago(db, reservaId, 1);

    // SPLIT del Anexo I con el motor vigente (50/40/10 de la comisión):
    // el DUEÑO recibe tarifa_neta Y la participación comercial.
    const [trx] = await db
      .select()
      .from(transacciones)
      .where(eq(transacciones.linkId, linkId));
    const filas = await db.select().from(splits).where(eq(splits.transaccionId, trx.id));
    const por = (c: string) => filas.find((f) => f.concepto === c)!;

    expect(por("tarifa_neta").beneficiarioId).toBe(duenoId);
    expect(Number(por("tarifa_neta").montoCentavos)).toBe(2_500_000_00);
    expect(por("comision_principal").beneficiarioId).toBe(duenoId); // ← dueño como gestor
    expect(Number(por("comision_principal").montoCentavos)).toBe(250_000_00);
    expect(por("comision_externo").beneficiarioId).toBe(socioVentasId);
    expect(Number(por("comision_externo").montoCentavos)).toBe(200_000_00);
    expect(Number(por("comision_app").montoCentavos)).toBe(50_000_00);

    const [res] = await db.select().from(reservas).where(eq(reservas.id, reservaId));
    expect(res.principalId).toBe(duenoId);
  });

  it("el cambio de modelo se bloquea con reservas activas (principio de flexibilidad)", async () => {
    await expect(
      editarPropiedad(db, duenoId, propiedadId, { ownerDirect: false }),
    ).rejects.toThrow(PropiedadError);
  });

  it("una solicitud inválida sigue rechazándose igual en gestión directa", async () => {
    await expect(
      crearSolicitud(db, {
        externoId: socioVentasId,
        propiedadId,
        desde: "2026-11-01",
        hasta: "2026-11-01",
        huespedes: 2,
      }),
    ).rejects.toThrow(OperacionError);
  });
});
