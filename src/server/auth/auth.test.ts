import { beforeAll, describe, expect, it } from "vitest";
import { desc, eq, sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  calendarioDias, linksDePago, notificacionesDev, propiedades,
  reservas, solicitudes, usuarios,
} from "../db/schema";
import {
  AuthError, elevarAdmin, puedeAccederSeccion, exigirRol,
  solicitarOtp, validarSesion, verificarOtpYCrearSesion,
} from "./index";
import { registrarUsuario, RegistroError } from "../servicios/registro";
import { obtenerKyc } from "../adaptadores/kyc";
import { procesarMensaje } from "../servicios/antifuga";
import { cifrar, codigoTotp, descifrar, generarSecretoTotp, verificarTotp } from "../crypto";
import { POST as webhookPost } from "@/app/api/webhooks/pasarela/route";
import { firmarEventoSimulado } from "../adaptadores/pasarela";

const HAY_DB = Boolean(process.env.DATABASE_URL);

describe("crypto puro", () => {
  it("cifrar/descifrar AES-GCM roundtrip", () => {
    expect(descifrar(cifrar("1.234.567.890"))).toBe("1.234.567.890");
  });
  it("TOTP: código válido en ventana ±1, inválido fuera", () => {
    const secreto = generarSecretoTotp();
    const ahora = Date.now();
    expect(verificarTotp(secreto, codigoTotp(secreto, ahora), ahora)).toBe(true);
    expect(verificarTotp(secreto, codigoTotp(secreto, ahora - 30_000), ahora)).toBe(true);
    expect(verificarTotp(secreto, codigoTotp(secreto, ahora - 120_000), ahora)).toBe(false);
    expect(verificarTotp(secreto, "000000", ahora)).toBe(false);
  });
});

describe("guards puros — matriz rol × sección", () => {
  it("cada rol accede SOLO a su sección; admin a todo; nadie a lo ajeno", () => {
    for (const seccion of ["propietario", "principal", "externo", "admin"] as const) {
      expect(puedeAccederSeccion([seccion], seccion)).toBe(true);
      expect(puedeAccederSeccion(["admin"], seccion)).toBe(true);
      for (const otro of ["propietario", "principal", "externo"] as const) {
        if (otro !== seccion) expect(puedeAccederSeccion([otro], seccion)).toBe(false);
      }
    }
    expect(puedeAccederSeccion([], "propietario")).toBe(false);
  });
});

describe.skipIf(!HAY_DB)("integración — auth + KYC + pago simulado", () => {
  let db: Db;
  const correo = (m: string) => `${m}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;

  beforeAll(() => {
    db = obtenerDb();
  });

  const ultimoOtpDe = async (email: string): Promise<string> => {
    const [n] = await db
      .select()
      .from(notificacionesDev)
      .where(eq(notificacionesDev.destinatario, email))
      .orderBy(desc(notificacionesDev.enviadaEn))
      .limit(1);
    return n.cuerpo.match(/(\d{6})/)![1];
  };

  it("registro real: pendiente_kyc + alias + KYC simulado aprueba → activo", async () => {
    const email = correo("reg");
    const r = await registrarUsuario(db, {
      nombreReal: "Comisionista Prueba",
      cedula: `10${Date.now()}`,
      email,
      telefono: "3000000000",
      rol: "externo",
    });
    expect(r.alias).toMatch(/^[A-Z]+-\d{3}$/);

    const [antes] = await db.select().from(usuarios).where(eq(usuarios.id, r.usuarioId));
    expect(antes.estado).toBe("pendiente_kyc");
    expect(antes.cedulaCifrada).not.toContain(String(Date.now()).slice(0, 4)); // cifrada, no en claro

    const estado = await obtenerKyc().procesarResultado(db, { checkId: r.kycCheckId, aprobado: true });
    expect(estado).toBe("activo");
  }, 30_000);

  it("KYC rechazado → kyc_rechazado; el usuario NO puede operar", async () => {
    const r = await registrarUsuario(db, {
      nombreReal: "Rechazado Prueba",
      cedula: `20${Date.now()}`,
      email: correo("rech"),
      telefono: "3000000001",
      rol: "principal",
    });
    const estado = await obtenerKyc().procesarResultado(db, { checkId: r.kycCheckId, aprobado: false });
    expect(estado).toBe("kyc_rechazado");
  }, 30_000);

  it("ban perpetuo end-to-end: baneado intenta re-registrarse con OTRO correo → rechazado", async () => {
    const cedula = `30${Date.now()}`;
    const r = await registrarUsuario(db, {
      nombreReal: "Fugitivo KYC",
      cedula,
      email: correo("fug1"),
      telefono: "3000000002",
      rol: "externo",
    });
    await obtenerKyc().procesarResultado(db, { checkId: r.kycCheckId, aprobado: true });
    // 3 strikes → ban a la identidad
    await procesarMensaje(db, r.usuarioId, "wa.me/573001112233");
    await procesarMensaje(db, r.usuarioId, "escríbeme al 3105551234");
    await procesarMensaje(db, r.usuarioId, "mi insta @fugitivo");

    // (a) el registro directo con la misma cédula y otro correo muere
    await expect(
      registrarUsuario(db, {
        nombreReal: "Fugitivo Renacido",
        cedula,
        email: correo("fug2"),
        telefono: "3000000003",
        rol: "externo",
      }),
    ).rejects.toThrow(RegistroError);
  }, 30_000);

  it("login OTP completo + sesión + guard: externo NO entra a sección propietario", async () => {
    const email = correo("login");
    const r = await registrarUsuario(db, {
      nombreReal: "Externo Login",
      cedula: `40${Date.now()}`,
      email,
      telefono: "3000000004",
      rol: "externo",
    });
    await obtenerKyc().procesarResultado(db, { checkId: r.kycCheckId, aprobado: true });

    await solicitarOtp(db, email);
    const codigo = await ultimoOtpDe(email);

    // código equivocado suma intento y NO abre sesión
    await expect(verificarOtpYCrearSesion(db, email, "000001")).rejects.toThrow(AuthError);

    const { token } = await verificarOtpYCrearSesion(db, email, codigo);
    const usuario = await validarSesion(db, token);
    expect(usuario?.email).toBe(email);
    expect(usuario?.roles).toEqual(["externo"]);

    expect(() => exigirRol(usuario, "externo")).not.toThrow();
    expect(() => exigirRol(usuario, "propietario")).toThrow(AuthError);
    expect(() => exigirRol(null, "externo")).toThrow(AuthError);

    // el mismo OTP no se puede reusar
    await expect(verificarOtpYCrearSesion(db, email, codigo)).rejects.toThrow(AuthError);
  }, 30_000);

  it("rate limit: el sexto OTP en una hora se rechaza", async () => {
    const email = correo("rate");
    for (let i = 0; i < 5; i++) await solicitarOtp(db, email);
    await expect(solicitarOtp(db, email)).rejects.toThrow(/Demasiados/);
  }, 30_000);

  it("admin: sin TOTP no hay elevación; con TOTP sí", async () => {
    const email = correo("admin");
    const secreto = generarSecretoTotp();
    const [u] = await db
      .insert(usuarios)
      .values({
        nombreReal: "Admin Prueba",
        cedulaHash: `admin-${Date.now()}`,
        cedulaCifrada: "x",
        email,
        telefonoCifrado: "x",
        roles: ["admin"],
        estado: "activo",
        totpSecret: secreto,
      })
      .returning({ id: usuarios.id });
    void u;
    await solicitarOtp(db, email);
    const { token } = await verificarOtpYCrearSesion(db, email, await ultimoOtpDe(email));

    let usuario = await validarSesion(db, token);
    expect(usuario?.adminElevada).toBe(false);
    await expect(elevarAdmin(db, token, "999999")).rejects.toThrow(AuthError);

    await elevarAdmin(db, token, codigoTotp(secreto));
    usuario = await validarSesion(db, token);
    expect(usuario?.adminElevada).toBe(true);
  }, 30_000);

  it("webhook: firma inválida → 401; pago simulado por el MISMO webhook → procesado", async () => {
    // Fixture mínimo reserva+link
    const [prop] = await db
      .insert(usuarios)
      .values({
        nombreReal: "P", cedulaHash: `wh-${Date.now()}`, cedulaCifrada: "x",
        email: correo("wh"), telefonoCifrado: "x", roles: ["propietario"], estado: "activo",
      })
      .returning({ id: usuarios.id });
    const [pr] = await db
      .insert(propiedades)
      .values({
        propietarioId: prop.id, nombre: "WH Test", municipio: "Guatapé", zona: "Oriente",
        tipo: "finca", capacidad: 4, habitaciones: 2, banos: 1,
      })
      .returning({ id: propiedades.id });
    await db.insert(calendarioDias).values({ propiedadId: pr.id, fecha: "2026-10-10", estado: "disponible" });
    const [s] = await db
      .insert(solicitudes)
      .values({
        externoId: prop.id, propiedadId: pr.id, desde: "2026-10-10", hasta: "2026-10-10",
        huespedes: 2, estado: "aceptada",
        venceEn: sql`now() + interval '1 hour'` as unknown as Date,
      })
      .returning({ id: solicitudes.id });
    const [res] = await db
      .insert(reservas)
      .values({
        codigo: `EST-WH-${Date.now()}`, solicitudId: s.id, propiedadId: pr.id,
        principalId: prop.id, externoId: prop.id, desde: "2026-10-10", hasta: "2026-10-10",
        estado: "LINK_1_ENVIADO", precioFinalCentavos: 100_000_000, tarifaNetaCentavos: 90_000_000,
      })
      .returning({ id: reservas.id });
    const [lnk] = await db
      .insert(linksDePago)
      .values({
        reservaId: res.id, mitad: 1, montoCentavos: 50_000_000,
        url: `/pago/wh-${Date.now()}`,
        venceEn: sql`now() + interval '1 day'` as unknown as Date,
      })
      .returning({ id: linksDePago.id });

    const evento = JSON.stringify({
      pasarelaRef: `evt-wh-${Date.now()}`, linkId: lnk.id, montoCentavos: 50_000_000, estado: "aprobada",
    });

    // firma inválida
    const mala = await webhookPost(
      new Request("http://t/api/webhooks/pasarela", {
        method: "POST",
        headers: { "x-firma-estadia": "0".repeat(64) },
        body: evento,
      }),
    );
    expect(mala.status).toBe(401);

    // firma válida — el MISMO camino que la pasarela real
    const buena = await webhookPost(
      new Request("http://t/api/webhooks/pasarela", {
        method: "POST",
        headers: { "x-firma-estadia": firmarEventoSimulado(evento) },
        body: evento,
      }),
    );
    expect(buena.status).toBe(200);
    expect((await buena.json()).resultado).toBe("procesado");

    const [reserva] = await db.select().from(reservas).where(eq(reservas.id, res.id));
    expect(reserva.estado).toBe("ANTICIPO_PAGADO");
  }, 30_000);
});
