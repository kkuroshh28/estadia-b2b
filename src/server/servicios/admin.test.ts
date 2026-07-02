import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  auditoriaAdmin, calendarioDias, configuracionPlataforma, linksDePago,
  propiedades, reservas, solicitudes, splits, transacciones, usuarios,
} from "../db/schema";
import {
  aprobarPropiedad, conciliar, editarConfiguracion, reembolsar, revertirBan,
} from "./admin";
import { procesarMensaje } from "./antifuga";
import { procesarWebhookPago } from "./pagos";
import { AuthError, type UsuarioSesion } from "../auth";

const HAY_DB = Boolean(process.env.DATABASE_URL);

const NO_ADMIN: UsuarioSesion = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "externo@test", roles: ["externo"], estado: "activo", adminElevada: false,
};
const ADMIN_SIN_2FA: UsuarioSesion = { ...NO_ADMIN, roles: ["admin"] };

describe("guards admin — puros", () => {
  it("un no-admin y un admin SIN TOTP son rechazados en TODA operación admin", async () => {
    // No requieren DB: el guard corta antes de tocarla.
    const db = null as unknown as Db;
    for (const actor of [NO_ADMIN, ADMIN_SIN_2FA, null]) {
      await expect(aprobarPropiedad(db, actor, "x")).rejects.toThrow(AuthError);
      await expect(editarConfiguracion(db, actor, "vigencias", {})).rejects.toThrow(AuthError);
      await expect(reembolsar(db, actor, "x", "CONFIRMO REEMBOLSO")).rejects.toThrow(AuthError);
      await expect(revertirBan(db, actor, "x", "REVERTIR BAN DEFINITIVAMENTE", "motivo largo suficiente aquí")).rejects.toThrow(AuthError);
    }
  });
});

describe.skipIf(!HAY_DB)("integración — operaciones admin auditadas", () => {
  let db: Db;
  let admin: UsuarioSesion;

  beforeAll(async () => {
    db = obtenerDb();
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: "Admin Ops", cedulaHash: `adm-${Date.now()}`, cedulaCifrada: "x",
        email: `admin-ops-${Date.now()}@test.local`, telefonoCifrado: "x",
        roles: ["admin"], estado: "activo",
      })
      .returning({ id: usuarios.id });
    admin = { id: u.id, email: "admin", roles: ["admin"], estado: "activo", adminElevada: true };
  });

  it("editar configuración queda auditada con valor anterior y nuevo", async () => {
    await editarConfiguracion(db, admin, "vigencias", { oferta_horas: 8 });
    const [fila] = await db
      .select()
      .from(configuracionPlataforma)
      .where(eq(configuracionPlataforma.clave, "vigencias"));
    expect((fila.valor as { oferta_horas: number }).oferta_horas).toBe(8);
    const auditorias = await db
      .select()
      .from(auditoriaAdmin)
      .where(eq(auditoriaAdmin.adminId, admin.id));
    expect(auditorias.some((a) => a.accion === "editar_configuracion")).toBe(true);
  }, 30_000);

  it("el split 50/40/10 NO es editable ni siquiera por admin", async () => {
    await expect(editarConfiguracion(db, admin, "split", { principal: 0.9 })).rejects.toThrow(/regla de negocio/);
  });

  it("reembolso: doble confirmación + contra-splits → la conciliación sigue cuadrando", async () => {
    // Fixture: pago procesado por el motor real
    const [u] = await db.insert(usuarios).values({
      nombreReal: "X", cedulaHash: `re-${Date.now()}`, cedulaCifrada: "x",
      email: `re-${Date.now()}@t.l`, telefonoCifrado: "x", roles: ["propietario"], estado: "activo",
    }).returning({ id: usuarios.id });
    const [p] = await db.insert(propiedades).values({
      propietarioId: u.id, nombre: "Reembolso Test", municipio: "X", zona: "X",
      tipo: "finca", capacidad: 2, habitaciones: 1, banos: 1,
    }).returning({ id: propiedades.id });
    await db.insert(calendarioDias).values({ propiedadId: p.id, fecha: "2026-11-11", estado: "disponible" });
    const [s] = await db.insert(solicitudes).values({
      externoId: u.id, propiedadId: p.id, desde: "2026-11-11", hasta: "2026-11-11",
      huespedes: 2, estado: "aceptada", venceEn: sql`now() + interval '1 h'` as unknown as Date,
    }).returning({ id: solicitudes.id });
    const [r] = await db.insert(reservas).values({
      codigo: `EST-RE-${Date.now()}`, solicitudId: s.id, propiedadId: p.id,
      principalId: u.id, externoId: u.id, desde: "2026-11-11", hasta: "2026-11-11",
      estado: "LINK_1_ENVIADO", precioFinalCentavos: 200_000_000, tarifaNetaCentavos: 170_000_000,
    }).returning({ id: reservas.id });
    void r;
    const [l] = await db.insert(linksDePago).values({
      reservaId: r.id, mitad: 1, montoCentavos: 100_000_000,
      url: `/pago/re-${Date.now()}`, venceEn: sql`now() + interval '1 d'` as unknown as Date,
    }).returning({ id: linksDePago.id });
    const ref = `evt-re-${Date.now()}`;
    await procesarWebhookPago(db, { pasarelaRef: ref, linkId: l.id, montoCentavos: 100_000_000, estado: "aprobada" });

    const [t] = await db.select().from(transacciones).where(eq(transacciones.pasarelaRef, ref));

    // Frase incorrecta → rechazado
    await expect(reembolsar(db, admin, t.id, "confirmo")).rejects.toThrow(/frase exacta/);

    await reembolsar(db, admin, t.id, "CONFIRMO REEMBOLSO");
    const [t2] = await db.select().from(transacciones).where(eq(transacciones.id, t.id));
    expect(t2.estado).toBe("reversada");

    // Contra-splits: la suma neta de splits de la transacción = 0
    const filas = await db.select().from(splits).where(eq(splits.transaccionId, t.id));
    expect(filas).toHaveLength(8); // 4 originales + 4 contra
    expect(filas.reduce((a, f) => a + Number(f.montoCentavos), 0)).toBe(0);

    // Y la conciliación global sigue cuadrando (reversadas quedan fuera)
    const conc = await conciliar(db);
    expect(conc.cuadra).toBe(true);
  }, 30_000);

  it("revertir ban: frase + motivo obligatorios, auditado, y el usuario vuelve a activo", async () => {
    const [u] = await db.insert(usuarios).values({
      nombreReal: "Ban Err", cedulaHash: `be-${Date.now()}`, cedulaCifrada: "x",
      email: `be-${Date.now()}@t.l`, telefonoCifrado: "x", roles: ["externo"], estado: "activo",
    }).returning({ id: usuarios.id });
    for (const m of ["3105551234", "por wsp", "@fugado"]) await procesarMensaje(db, u.id, m);
    const [antes] = await db.select().from(usuarios).where(eq(usuarios.id, u.id));
    expect(antes.estado).toBe("baneado");

    await expect(revertirBan(db, admin, u.id, "REVERTIR BAN DEFINITIVAMENTE", "corto")).rejects.toThrow(/documentarse/);
    await revertirBan(db, admin, u.id, "REVERTIR BAN DEFINITIVAMENTE", "Falso positivo comprobado del OCR en pruebas internas");

    const [despues] = await db.select().from(usuarios).where(eq(usuarios.id, u.id));
    expect(despues.estado).toBe("activo");
  }, 30_000);
});
