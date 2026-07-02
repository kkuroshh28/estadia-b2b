/**
 * Integración contra Postgres real — reglas #6, #8 y #16 end-to-end.
 * Se saltan sin DATABASE_URL; en CI corren contra el Postgres de servicio.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  alias as tablaAlias,
  configuracionPlataforma,
  linksDePago,
  negociaciones,
  ofertas,
  propiedades,
  reservas,
  solicitudes,
  usuarios,
} from "../db/schema";
import { aceptarOfertaYGenerarLink, OfertaNoAceptableError } from "./negociacion";
import { identidadBaneada, procesarMensaje } from "./antifuga";
import { asignarAliasUnico } from "./alias";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("integración — reglas 6, 8 y 16", () => {
  let db: Db;
  let principalId: string;
  let externoId: string;
  let propiedadId: string;

  const crearUsuario = async (rol: "propietario" | "principal" | "externo", marca: string) => {
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: `Test ${marca}`,
        cedulaHash: `hash-${marca}-${Date.now()}-${Math.random()}`,
        cedulaCifrada: "x",
        email: `t-${marca}-${Date.now()}-${Math.random()}@test.local`,
        telefonoCifrado: "x",
        roles: [rol],
        estado: "activo",
      })
      .returning({ id: usuarios.id });
    return u.id;
  };

  const montarNegociacion = async (montoOferta: number, neta: number) => {
    const [s] = await db
      .insert(solicitudes)
      .values({
        externoId, propiedadId, desde: "2026-09-10", hasta: "2026-09-13",
        huespedes: 4, estado: "aceptada", principalAceptanteId: principalId,
        venceEn: sql`now() + interval '1 hour'` as unknown as Date,
      })
      .returning({ id: solicitudes.id });
    await db.insert(reservas).values({
      codigo: `EST-NEG-${Date.now()}-${Math.random()}`,
      solicitudId: s.id, propiedadId, principalId, externoId,
      desde: "2026-09-10", hasta: "2026-09-13",
      estado: "NEGOCIACION",
      precioFinalCentavos: 0, tarifaNetaCentavos: neta,
    });
    const [n] = await db
      .insert(negociaciones)
      .values({ solicitudId: s.id, tarifaNetaCentavos: neta })
      .returning({ id: negociaciones.id });
    const [o] = await db
      .insert(ofertas)
      .values({
        negociacionId: n.id,
        emisorId: externoId,
        montoCentavos: montoOferta,
        venceEn: sql`now() + interval '6 hours'` as unknown as Date,
      })
      .returning({ id: ofertas.id });
    return { ofertaId: o.id };
  };

  beforeAll(async () => {
    db = obtenerDb();
    const propietarioId = await crearUsuario("propietario", "prop-neg");
    principalId = await crearUsuario("principal", "ppal-neg");
    externoId = await crearUsuario("externo", "ext-neg");
    const [p] = await db
      .insert(propiedades)
      .values({
        propietarioId, nombre: "Finca Test Reglas", municipio: "El Peñol",
        zona: "Oriente", tipo: "finca", capacidad: 8, habitaciones: 3, banos: 2,
      })
      .returning({ id: propiedades.id });
    propiedadId = p.id;
    await db
      .insert(configuracionPlataforma)
      .values({ clave: "piso_comision", valor: { activo: false, pct: 0.08 } })
      .onConflictDoNothing();
  });

  it("regla #6: el link nace EXACTAMENTE del precio aceptado (mitad 1 = floor(precio/2))", async () => {
    const precio = 510_000_001; // impar a propósito
    const { ofertaId } = await montarNegociacion(precio, 435_000_000);
    const { linkId, montoCentavos } = await aceptarOfertaYGenerarLink(db, ofertaId, principalId);

    expect(montoCentavos).toBe(Math.floor(precio / 2));
    const [link] = await db.select().from(linksDePago).where(eq(linksDePago.id, linkId));
    expect(link.montoCentavos).toBe(Math.floor(precio / 2));
    // Y la reserva quedó con el precio EXACTO de la oferta aceptada
    const [n] = await db.select().from(negociaciones).where(sql`precio_acordado_centavos = ${precio}`).limit(1);
    expect(n).toBeTruthy();
  }, 30_000);

  it("regla #6: nadie puede aceptar su propia oferta ni una no-activa", async () => {
    const { ofertaId } = await montarNegociacion(500_000_000, 435_000_000);
    await expect(aceptarOfertaYGenerarLink(db, ofertaId, externoId)).rejects.toThrow(
      OfertaNoAceptableError,
    );
  }, 30_000);

  it("regla #8: al ENCENDER el piso en configuración, la aceptación rechaza ofertas bajo el piso", async () => {
    await db
      .update(configuracionPlataforma)
      .set({ valor: { activo: true, pct: 0.08 } })
      .where(eq(configuracionPlataforma.clave, "piso_comision"));
    try {
      // neta 435M + 8% = 469.8M → una oferta de 450M debe rechazarse
      const { ofertaId } = await montarNegociacion(450_000_000, 435_000_000);
      await expect(aceptarOfertaYGenerarLink(db, ofertaId, principalId)).rejects.toThrow(/Piso/);
    } finally {
      await db
        .update(configuracionPlataforma)
        .set({ valor: { activo: false, pct: 0.08 } })
        .where(eq(configuracionPlataforma.clave, "piso_comision"));
    }
  }, 30_000);

  it("regla #16 e2e: 3 strikes → ban + lista negra por identidad + alias retirado + re-registro rechazado", async () => {
    const fugitivoId = await crearUsuario("externo", "fugitivo");
    const aliasFugitivo = await asignarAliasUnico(db, fugitivoId);

    const r1 = await procesarMensaje(db, fugitivoId, "mi número es 3105551234");
    const r2 = await procesarMensaje(db, fugitivoId, "escríbeme por wsp");
    const r3 = await procesarMensaje(db, fugitivoId, "tres uno cero cinco cinco cinco uno dos tres cuatro");

    expect(r1).toMatchObject({ veredicto: "bloqueado", strikes: 1, baneado: false });
    expect(r2).toMatchObject({ veredicto: "bloqueado", strikes: 2, baneado: false });
    expect(r3).toMatchObject({ veredicto: "bloqueado", baneado: true });

    // Usuario baneado
    const [u] = await db.select().from(usuarios).where(eq(usuarios.id, fugitivoId));
    expect(u.estado).toBe("baneado");

    // Identidad en lista negra → el KYC de un re-registro con otro correo lo rechaza
    expect(await identidadBaneada(db, u.cedulaHash)).toBe(true);

    // Alias retirado PARA SIEMPRE (jamás se reasigna)
    const [a] = await db.select().from(tablaAlias).where(eq(tablaAlias.alias, aliasFugitivo));
    expect(a.retirado).toBe(true);
    expect(a.usuarioId).toBeNull();

    // Un mensaje LIMPIO de un usuario sano pasa
    const sanoId = await crearUsuario("externo", "sano");
    expect(await procesarMensaje(db, sanoId, "el cliente llega a las 3 pm")).toEqual({
      veredicto: "permitido",
    });
  }, 30_000);
});
