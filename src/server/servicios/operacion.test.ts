/**
 * Fase 4.5-4.6: iCal, contratos, OCR y el FLUJO COMPLETO end-to-end:
 * registro → KYC → propiedad → solicitud → negociación → pago simulado (por el
 * MISMO webhook firmado) → split → contrato → semáforo verde → completada.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  alertasAdmin, calendarioDias, contratos, linksDePago, mensajesChat,
  negociaciones, notificacionesDev, ofertas, propiedades, reservas,
  solicitudes, splits, suscripciones, transacciones,
} from "../db/schema";
import { exportarIcs, importarIcs, parsearIcs, tokenIcal, verificarTokenIcal } from "./ical";
import { puedeVerContrato } from "./contratos";
import { recibirImagenChat } from "./ocr-chat";
import { registrarUsuario } from "./registro";
import { obtenerKyc } from "../adaptadores/kyc";
import { aceptarSolicitud } from "./reservas";
import { aceptarOfertaYGenerarLink } from "./negociacion";
import { entregaAutorizada } from "@/lib/domain/reserva";
import { transicionarReserva } from "./reservas";
import { firmarEventoSimulado } from "../adaptadores/pasarela";
import { POST as webhookPost } from "@/app/api/webhooks/pasarela/route";

const HAY_DB = Boolean(process.env.DATABASE_URL);

const ICS_AIRBNB = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261120",
  "DTEND;VALUE=DATE:20261123",
  "SUMMARY:Airbnb (Not available)",
  "UID:airbnb-123@airbnb.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261201T140000Z",
  "DTEND:20261202T100000Z",
  "SUMMARY:Reserved",
  "UID:booking-456@booking.com",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("iCal — parser puro", () => {
  it("lee VALUE=DATE (Airbnb) y datetime UTC (Booking), DTEND exclusivo", () => {
    const eventos = parsearIcs(ICS_AIRBNB);
    expect(eventos).toEqual([
      { desde: "2026-11-20", hasta: "2026-11-23" },
      { desde: "2026-12-01", hasta: "2026-12-02" },
    ]);
  });
  it("token de export: válido solo el propio", () => {
    expect(verificarTokenIcal("prop-x", tokenIcal("prop-x"))).toBe(true);
    expect(verificarTokenIcal("prop-x", tokenIcal("prop-y"))).toBe(false);
    expect(verificarTokenIcal("prop-x", "cualquiera")).toBe(false);
  });
});

describe.skipIf(!HAY_DB)("integración — operación completa", () => {
  let db: Db;

  beforeAll(() => {
    db = obtenerDb();
  });

  const registrarYAprobar = async (rol: "propietario" | "principal" | "externo", marca: string) => {
    const r = await registrarUsuario(db, {
      nombreReal: `Persona ${marca}`,
      cedula: `9${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: `${marca}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`,
      telefono: "3001234567",
      rol,
    });
    await obtenerKyc().procesarResultado(db, { checkId: r.kycCheckId, aprobado: true });
    return r.usuarioId;
  };

  it("iCal: importa Airbnb, bloquea días libres y alerta el conflicto con reserva pagada", async () => {
    const duenoId = await registrarYAprobar("propietario", "ical");
    const [p] = await db.insert(propiedades).values({
      propietarioId: duenoId, nombre: "iCal Test", municipio: "Guatapé", zona: "Oriente",
      tipo: "finca", capacidad: 6, habitaciones: 3, banos: 2,
    }).returning({ id: propiedades.id });

    // El 21 nov YA está reservado por la app (pago confirmado)
    await db.insert(calendarioDias).values([
      { propiedadId: p.id, fecha: "2026-11-20", estado: "disponible" },
      { propiedadId: p.id, fecha: "2026-11-21", estado: "reservado_app" },
      { propiedadId: p.id, fecha: "2026-11-22", estado: "disponible" },
    ]);

    const r = await importarIcs(db, p.id, ICS_AIRBNB, "airbnb");
    expect(r.diasBloqueados).toBeGreaterThanOrEqual(3); // 20, 22 + 01 dic
    expect(r.conflictos).toBe(1); // el 21 NO se pisa

    const [dia21] = await db.select().from(calendarioDias)
      .where(and(eq(calendarioDias.propiedadId, p.id), eq(calendarioDias.fecha, "2026-11-21")));
    expect(dia21.estado).toBe("reservado_app"); // el dinero manda

    const alertas = await db.select().from(alertasAdmin).where(eq(alertasAdmin.tipo, "conflicto_ical"));
    expect(alertas.length).toBeGreaterThanOrEqual(1);

    // Export: el .ics propio contiene los días no disponibles
    const ics = await exportarIcs(db, p.id);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261121");
    expect(ics).toContain("BEGIN:VCALENDAR");
  }, 30_000);

  it("OCR: imagen con teléfono → bloqueada y strike; imagen limpia → aprobada", async () => {
    const uid = await registrarYAprobar("externo", "ocr");
    const conFuga = await recibirImagenChat(db, uid, null, Buffer.from("llámame al 310 555 1234"));
    expect(conFuga.estado).toBe("bloqueado");
    const limpia = await recibirImagenChat(db, uid, null, Buffer.from("foto de la piscina"));
    expect(limpia.estado).toBe("aprobado");
    const [m] = await db.select().from(mensajesChat).where(eq(mensajesChat.id, conFuga.mensajeId));
    expect(m.ocrEstado).toBe("bloqueado");
    expect(m.bloqueado).toBe(true);
  }, 30_000);

  it("FLUJO COMPLETO: registro → KYC → propiedad → solicitud → negociación → pago 1 y 2 por webhook → splits → contrato → semáforo verde → completada", async () => {
    // 1 · Actores reales con KYC aprobado
    const duenoId = await registrarYAprobar("propietario", "e2e-dueno");
    const principalId = await registrarYAprobar("principal", "e2e-ppal");
    const externoId = await registrarYAprobar("externo", "e2e-ext");

    // 2 · Propiedad publicada con suscripción activa y calendario libre
    const [prop] = await db.insert(propiedades).values({
      propietarioId: duenoId, nombre: "Finca E2E", municipio: "El Peñol", zona: "Oriente",
      tipo: "finca", capacidad: 8, habitaciones: 4, banos: 3, verificada: true, publicada: true,
    }).returning({ id: propiedades.id });
    await db.insert(suscripciones).values({
      propietarioId: duenoId, plan: "piloto", estado: "activa", renuevaEn: "2026-08-01",
    });
    for (let d = 10; d <= 13; d++) {
      await db.insert(calendarioDias).values({ propiedadId: prop.id, fecha: `2026-12-${d}`, estado: "disponible" });
    }

    // 3 · Solicitud del externo; el principal la gana (primero que acepta)
    const [sol] = await db.insert(solicitudes).values({
      externoId, propiedadId: prop.id, desde: "2026-12-10", hasta: "2026-12-13",
      huespedes: 6, estado: "pendiente",
      venceEn: sql`now() + interval '1 hour'` as unknown as Date,
    }).returning({ id: solicitudes.id });
    expect(await aceptarSolicitud(db, sol.id, principalId)).toBe(true);
    expect(await aceptarSolicitud(db, sol.id, duenoId)).toBe(false); // llegó tarde

    // 4 · Reserva en negociación + oferta del externo aceptada por el principal
    const NETA = 435_000_000; // $4.350.000 (3 noches)
    const PRECIO = 510_000_000; // $5.100.000
    const [res] = await db.insert(reservas).values({
      codigo: `EST-E2E-${Date.now()}`, solicitudId: sol.id, propiedadId: prop.id,
      principalId, externoId, desde: "2026-12-10", hasta: "2026-12-13",
      estado: "NEGOCIACION", precioFinalCentavos: 0, tarifaNetaCentavos: NETA,
    }).returning({ id: reservas.id, codigo: reservas.codigo });
    const [neg] = await db.insert(negociaciones).values({
      solicitudId: sol.id, tarifaNetaCentavos: NETA,
    }).returning({ id: negociaciones.id });
    const [of] = await db.insert(ofertas).values({
      negociacionId: neg.id, emisorId: externoId, montoCentavos: PRECIO,
      venceEn: sql`now() + interval '6 hours'` as unknown as Date,
    }).returning({ id: ofertas.id });

    const { linkId, montoCentavos } = await aceptarOfertaYGenerarLink(db, of.id, principalId);
    expect(montoCentavos).toBe(PRECIO / 2);
    await transicionarReserva(db, res.id, "PRECIO_ACORDADO", principalId);
    await transicionarReserva(db, res.id, "LINK_1_ENVIADO", "sistema");

    // 5 · PAGO 1 por el MISMO webhook firmado de la pasarela (driver simulado)
    const pagar = async (lid: string, monto: number) => {
      const evento = JSON.stringify({
        pasarelaRef: `evt-e2e-${lid}-${Date.now()}`, linkId: lid, montoCentavos: monto, estado: "aprobada",
      });
      const resp = await webhookPost(new Request("http://t/api/webhooks/pasarela", {
        method: "POST",
        headers: { "x-firma-estadia": firmarEventoSimulado(evento) },
        body: evento,
      }));
      expect(resp.status).toBe(200);
      return (await resp.json()).resultado;
    };
    expect(await pagar(linkId, PRECIO / 2)).toBe("procesado");

    // Estado + calendario bloqueado + splits exactos + contrato + notificaciones
    let [r] = await db.select().from(reservas).where(eq(reservas.id, res.id));
    expect(r.estado).toBe("ANTICIPO_PAGADO");
    expect(entregaAutorizada(r.estado as never)).toBe(false); // aún sin verde

    const dias = await db.select().from(calendarioDias)
      .where(and(eq(calendarioDias.propiedadId, prop.id), sql`fecha BETWEEN '2026-12-10' AND '2026-12-13'`));
    for (const d of dias) expect(d.estado).toBe("reservado_app");

    const [c] = await db.select().from(contratos).where(eq(contratos.reservaId, res.id));
    expect(c.tipo).toBe("vivienda_turistica"); // 3 noches < 30
    expect(c.hashSha256).toMatch(/^[a-f0-9]{64}$/);

    // Acceso al contrato: propietario SÍ, comisionistas JAMÁS
    expect(await puedeVerContrato(db, duenoId, res.id)).toBe(true);
    expect(await puedeVerContrato(db, principalId, res.id)).toBe(false);
    expect(await puedeVerContrato(db, externoId, res.id)).toBe(false);

    const noti = await db.select().from(notificacionesDev)
      .orderBy(desc(notificacionesDev.enviadaEn)).limit(10);
    expect(noti.some((n) => n.asunto.includes("Pago confirmado"))).toBe(true);

    // 6 · Link 2 + PAGO 2 → PAGO_COMPLETO → semáforo verde → check-in → completada
    await transicionarReserva(db, res.id, "SALDO_LINK_ENVIADO", "sistema");
    const [l2] = await db.insert(linksDePago).values({
      reservaId: res.id, mitad: 2, montoCentavos: PRECIO / 2,
      url: `/pago/e2e-2-${Date.now()}`, venceEn: sql`now() + interval '1 day'` as unknown as Date,
    }).returning({ id: linksDePago.id });
    expect(await pagar(l2.id, PRECIO / 2)).toBe("procesado");

    [r] = await db.select().from(reservas).where(eq(reservas.id, res.id));
    expect(r.estado).toBe("PAGO_COMPLETO");
    expect(entregaAutorizada(r.estado as never)).toBe(true); // VERDE: se entrega

    // Dinero: las DOS transacciones cuadran al centavo, comisión completa repartida
    const trx = await db.select().from(transacciones)
      .where(sql`link_id IN (SELECT id FROM links_de_pago WHERE reserva_id = ${res.id})`);
    expect(trx).toHaveLength(2);
    let comisionTotal = 0;
    for (const t of trx) {
      const filas = await db.select().from(splits).where(eq(splits.transaccionId, t.id));
      const suma = filas.reduce((a, f) => a + Number(f.montoCentavos), 0);
      expect(suma).toBe(Number(t.montoCentavos)); // Σ splits = monto EXACTO
      comisionTotal += filas
        .filter((f) => f.concepto.startsWith("comision"))
        .reduce((a, f) => a + Number(f.montoCentavos), 0);
    }
    expect(comisionTotal).toBe(PRECIO - NETA); // comisión = precio − neta, exacta

    await transicionarReserva(db, res.id, "CHECK_IN", duenoId);
    await transicionarReserva(db, res.id, "COMPLETADA", "sistema");
    [r] = await db.select().from(reservas).where(eq(reservas.id, res.id));
    expect(r.estado).toBe("COMPLETADA");
  }, 60_000);
});
