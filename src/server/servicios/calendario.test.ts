/**
 * Regla #14 en servidor: solo el propietario escribe su calendario y JAMÁS
 * puede tocar días reservado_app (dinero) ni bloqueado_ical (sync externa).
 * Corre contra Postgres real; se salta sin DATABASE_URL.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import { calendarioDias, propiedades, usuarios } from "../db/schema";
import { bloquearDias, CalendarioError, liberarDias } from "./calendario";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAY_DB)("calendario — escritura del propietario (regla #14)", () => {
  let db: Db;
  let duenoId: string;
  let intrusoId: string;
  let propiedadId: string;

  const crearUsuario = async (n: string) => {
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: `Cal ${n}`,
        cedulaHash: `cal-${n}-${Date.now()}-${Math.random()}`,
        cedulaCifrada: "x",
        email: `cal-${n}-${Date.now()}-${Math.random()}@test.local`,
        telefonoCifrado: "x",
        roles: ["propietario"],
        estado: "activo",
      })
      .returning({ id: usuarios.id });
    return u.id;
  };

  beforeAll(async () => {
    db = obtenerDb();
    duenoId = await crearUsuario("dueno");
    intrusoId = await crearUsuario("intruso");
    const [p] = await db
      .insert(propiedades)
      .values({
        propietarioId: duenoId,
        nombre: "Finca Test Calendario",
        municipio: "Guatapé",
        zona: "Oriente",
        tipo: "finca",
        capacidad: 8,
        habitaciones: 3,
        banos: 2,
        publicada: true,
      })
      .returning({ id: propiedades.id });
    propiedadId = p.id;

    await db.insert(calendarioDias).values([
      { propiedadId, fecha: "2027-03-01", estado: "disponible" },
      { propiedadId, fecha: "2027-03-02", estado: "reservado_app" },
      { propiedadId, fecha: "2027-03-03", estado: "bloqueado_ical" },
    ]);
  });

  const estadoDe = async (fecha: string) => {
    const [d] = await db
      .select({ estado: calendarioDias.estado })
      .from(calendarioDias)
      .where(and(eq(calendarioDias.propiedadId, propiedadId), eq(calendarioDias.fecha, fecha)));
    return d?.estado;
  };

  it("bloquea días disponibles (con fila y sin fila previa)", async () => {
    const n = await bloquearDias(db, duenoId, propiedadId, ["2027-03-01", "2027-03-04"]);
    expect(n).toBe(2);
    expect(await estadoDe("2027-03-01")).toBe("bloqueado_manual");
    expect(await estadoDe("2027-03-04")).toBe("bloqueado_manual"); // upsert sin fila previa
  });

  it("JAMÁS toca reservado_app ni bloqueado_ical", async () => {
    const n = await bloquearDias(db, duenoId, propiedadId, ["2027-03-02", "2027-03-03"]);
    expect(n).toBe(0);
    expect(await estadoDe("2027-03-02")).toBe("reservado_app");
    expect(await estadoDe("2027-03-03")).toBe("bloqueado_ical");

    const lib = await liberarDias(db, duenoId, propiedadId, ["2027-03-02", "2027-03-03"]);
    expect(lib).toBe(0);
    expect(await estadoDe("2027-03-02")).toBe("reservado_app");
  });

  it("libera solo bloqueos manuales", async () => {
    const n = await liberarDias(db, duenoId, propiedadId, ["2027-03-01"]);
    expect(n).toBe(1);
    expect(await estadoDe("2027-03-01")).toBe("disponible");
  });

  it("rechaza a quien no es el dueño de la propiedad", async () => {
    await expect(bloquearDias(db, intrusoId, propiedadId, ["2027-03-05"])).rejects.toThrow(
      CalendarioError,
    );
  });

  it("rechaza fechas malformadas (inyección imposible por formato)", async () => {
    await expect(bloquearDias(db, duenoId, propiedadId, ["2027-03-01'; DROP TABLE x;--"]))
      .rejects.toThrow(CalendarioError);
    await expect(bloquearDias(db, duenoId, propiedadId, [])).rejects.toThrow(CalendarioError);
  });
});
