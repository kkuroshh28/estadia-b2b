/**
 * Publicación: una propiedad sin tarifa neta vigente no se puede publicar
 * (caso del portafolio importado, que nace sin tarifa). Contra Postgres real.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import { propiedades, usuarios } from "../db/schema";
import { editarPropiedad, PropiedadError } from "./propiedades";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("Publicación — exige tarifa neta vigente", () => {
  let db: Db;
  let duenoId: string;
  let propiedadId: string;

  beforeAll(async () => {
    db = obtenerDb();
    const sello = `${Date.now()}-${Math.random()}`;
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: "PUB propietario",
        cedulaHash: `pub-${sello}`,
        cedulaCifrada: "x",
        email: `pub-${sello}@test.local`,
        telefonoCifrado: "x",
        roles: ["propietario"],
        estado: "activo",
      })
      .returning({ id: usuarios.id });
    duenoId = u.id;
    // Alta directa sin tarifa, como la hace el importador del portafolio.
    const [p] = await db
      .insert(propiedades)
      .values({
        propietarioId: duenoId,
        nombre: `Villa sin tarifa ${sello}`,
        municipio: "Cartagena de Indias",
        zona: "Isla Barú",
        tipo: "casa",
        capacidad: 14,
        habitaciones: 4,
        banos: 4,
        ownerDirect: true,
        fotos: ["/propiedades/villa-baru/baru-01.webp"],
      })
      .returning({ id: propiedades.id });
    propiedadId = p.id;
  });

  const publicada = async () =>
    (await db.select({ v: propiedades.publicada }).from(propiedades).where(eq(propiedades.id, propiedadId)))[0].v;

  it("sin tarifa: publicar se rechaza y sigue oculta", async () => {
    await expect(editarPropiedad(db, duenoId, propiedadId, { publicada: true })).rejects.toThrow(PropiedadError);
    expect(await publicada()).toBe(false);
  });

  it("con tarifa definida: publica", async () => {
    await editarPropiedad(db, duenoId, propiedadId, { tarifaNetaNochePesos: 4_500_000 });
    await editarPropiedad(db, duenoId, propiedadId, { publicada: true });
    expect(await publicada()).toBe(true);
  });

  it("tarifa y publicación en el mismo cambio también procede", async () => {
    await editarPropiedad(db, duenoId, propiedadId, { publicada: false });
    await editarPropiedad(db, duenoId, propiedadId, { tarifaNetaNochePesos: 5_000_000, publicada: true });
    expect(await publicada()).toBe(true);
  });
});
