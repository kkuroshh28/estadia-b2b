/**
 * Huéspedes adicionales: la tarifa base cubre N huéspedes; por encima se cobra
 * una tarifa POR PERSONA POR NOCHE que es del propietario (se suma a la neta
 * ANTES de negociar la comisión). Contra Postgres real.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import { negociaciones, propiedades, splits, transacciones, usuarios } from "../db/schema";
import { crearPropiedad, editarPropiedad, PropiedadError } from "./propiedades";
import { aceptarOferta, aceptarYAbrirNegociacion, contraofertar, crearSolicitud } from "./solicitudes";
import { procesarWebhookPago } from "./pagos";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("Huéspedes adicionales — el extra es del propietario", () => {
  let db: Db;
  let duenoId: string;
  let socioVentasId: string;
  let propiedadId: string;

  const crearUsuario = async (rol: "propietario" | "externo") => {
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: `AD ${rol}`,
        cedulaHash: `ad-${rol}-${Date.now()}-${Math.random()}`,
        cedulaCifrada: "x",
        email: `ad-${rol}-${Date.now()}-${Math.random()}@test.local`,
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
    socioVentasId = await crearUsuario("externo");

    // Base $500.000/noche para 4 incluidos; adicional $100.000 por persona-noche.
    const r = await crearPropiedad(db, duenoId, {
      nombre: `Finca Adicionales ${Date.now()}`,
      municipio: "El Retiro",
      zona: "Oriente",
      tipo: "finca",
      capacidad: 10,
      habitaciones: 4,
      banos: 3,
      amenidades: ["Piscina"],
      reglas: [],
      tarifaNetaNochePesos: 500_000,
      publicada: true,
      ownerDirect: true, // el dueño acepta directo — la neta se calcula igual en ambos modelos
      margenMinimoPesos: 300_000,
      huespedesIncluidos: 4,
      tarifaAdicionalPesos: 100_000,
    });
    propiedadId = r.propiedadId;
    await db.update(propiedades).set({ verificada: true }).where(eq(propiedades.id, propiedadId));
  });

  it("la neta de la negociación suma los adicionales y el mínimo se calcula sobre ella", async () => {
    // 6 huéspedes (2 adicionales) × 3 noches:
    // neta = 500.000×3 + 100.000×2×3 = $2.100.000
    const { solicitudId } = await crearSolicitud(db, {
      externoId: socioVentasId,
      propiedadId,
      desde: "2026-11-10",
      hasta: "2026-11-13",
      huespedes: 6,
    });
    const acept = await aceptarYAbrirNegociacion(db, solicitudId, duenoId);
    expect(acept.gano).toBe(true);
    const negociacionId = acept.negociacionId!;

    const [neg] = await db.select().from(negociaciones).where(eq(negociaciones.id, negociacionId));
    expect(Number(neg.tarifaNetaCentavos)).toBe(2_100_000_00);

    // Mínimo = neta CON adicionales + margen = $2.400.000 → $2.300.000 rechazada.
    await expect(contraofertar(db, negociacionId, socioVentasId, 2_300_000_00)).rejects.toThrow(
      /precio mínimo de venta/,
    );

    // $2.600.000 válida → comisión $500.000. El split respeta la neta con extra.
    const { ofertaId } = await contraofertar(db, negociacionId, socioVentasId, 2_600_000_00);
    const { linkId, montoCentavos } = await aceptarOferta(db, ofertaId, duenoId);
    expect(montoCentavos).toBe(1_300_000_00); // mitad exacta

    const pago = await procesarWebhookPago(db, {
      pasarelaRef: `ad-evt-${Date.now()}`,
      linkId,
      montoCentavos: 1_300_000_00,
      estado: "aprobada",
    });
    expect(pago.resultado).toBe("procesado");

    const [trx] = await db.select().from(transacciones).where(eq(transacciones.linkId, linkId));
    const filas = await db.select().from(splits).where(eq(splits.transaccionId, trx.id));
    const por = (c: string) => Number(filas.find((f) => f.concepto === c)!.montoCentavos);
    expect(por("tarifa_neta")).toBe(1_050_000_00); // mitad de $2.100.000 CON adicionales
    expect(por("comision_principal")).toBe(11_250_000); // 45% de $250.000
    expect(por("comision_externo")).toBe(11_250_000);
  });

  it("con huéspedes dentro de los incluidos NO se cobra extra", async () => {
    const { solicitudId } = await crearSolicitud(db, {
      externoId: socioVentasId,
      propiedadId,
      desde: "2026-12-01",
      hasta: "2026-12-03",
      huespedes: 4,
    });
    const acept = await aceptarYAbrirNegociacion(db, solicitudId, duenoId);
    const [neg] = await db
      .select()
      .from(negociaciones)
      .where(eq(negociaciones.id, acept.negociacionId!));
    expect(Number(neg.tarifaNetaCentavos)).toBe(1_000_000_00); // 500.000 × 2 noches, sin extra
  });

  it("valida incluidos ≤ capacidad y tarifa adicional en rango", async () => {
    await expect(
      crearPropiedad(db, duenoId, {
        nombre: "Inválida incluidos",
        municipio: "X",
        zona: "Y",
        tipo: "casa",
        capacidad: 4,
        habitaciones: 2,
        banos: 1,
        amenidades: [],
        reglas: [],
        tarifaNetaNochePesos: 300_000,
        publicada: false,
        huespedesIncluidos: 9, // > capacidad
        tarifaAdicionalPesos: 50_000,
      }),
    ).rejects.toThrow(PropiedadError);

    await expect(
      editarPropiedad(db, duenoId, propiedadId, { tarifaAdicionalPesos: -5 }),
    ).rejects.toThrow(PropiedadError);

    // Quitar la política vuelve a incluir toda la capacidad.
    await editarPropiedad(db, duenoId, propiedadId, { huespedesIncluidos: null });
    const [p] = await db.select().from(propiedades).where(eq(propiedades.id, propiedadId));
    expect(p.huespedesIncluidos).toBeNull();
  });
});
