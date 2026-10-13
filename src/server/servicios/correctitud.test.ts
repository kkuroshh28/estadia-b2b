import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { obtenerDb, type Db } from "../db";
import {
  auditoriaReservas, calendarioDias, compensaciones, linksDePago, negociaciones, ofertas, otps,
  propiedades, reservas, sesiones, solicitudes, suscripciones, transacciones, usuarios,
} from "../db/schema";
import { generarLinkSaldo, procesarWebhookPago, SaldoError } from "./pagos";
import { reembolsar } from "./admin";
import { expirarVigencias } from "./vigencias";
import { aceptarYAbrirNegociacion, contraofertar, crearSolicitud, OperacionError } from "./solicitudes";
import { aceptarOfertaYGenerarLink, OfertaNoAceptableError } from "./negociacion";
import { descargarIcs, importarIcs, sincronizarIcalPropiedad } from "./ical";
import { bloquearDias } from "./calendario";
import { puedeVerContrato } from "./contratos";
import { obtenerPasarela } from "../adaptadores/pasarela";
import { hoyEnBogota } from "@/lib/fechas";
import type { UsuarioSesion } from "../auth";

/**
 * Correctitud de dinero / reservas / concurrencia (auditoría 2026-10).
 * Cada caso reproduce un hallazgo verificado: falla con el código anterior
 * y pasa con el arreglo. Fechas RELATIVAS a hoy (Bogotá): sin bombas de tiempo.
 */

const HAY_DB = Boolean(process.env.DATABASE_URL);

/** Hoy (Bogotá) + n días, YYYY-MM-DD. */
function dia(n: number): string {
  const [y, m, d] = hoyEnBogota().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
const ymd = (iso: string) => iso.replaceAll("-", "");
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("descargarIcs — anti-SSRF con redirecciones y tope de tamaño", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rechaza una redirección hacia un dominio fuera de la lista", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }),
    ));
    await expect(descargarIcs("https://www.airbnb.com/calendar/ical/1.ics")).rejects.toThrow(/no permitida/);
  });

  it("sigue una redirección permitida y devuelve el cuerpo", async () => {
    const fetchFalso = vi.fn(async (url: string) =>
      url.includes("airbnb.com/calendar")
        ? new Response(null, { status: 301, headers: { location: "https://ical.booking.com/v1/x.ics" } })
        : new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchFalso);
    const texto = await descargarIcs("https://www.airbnb.com/calendar/ical/1.ics");
    expect(texto).toContain("BEGIN:VCALENDAR");
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    // redirect MANUAL: jamás se deja que fetch siga saltos sin re-validar
    expect((fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe("manual");
  });

  it("corta un cuerpo gigante SIN content-length al leerlo como stream", async () => {
    const trozo = new Uint8Array(512 * 1024).fill(65);
    let enviados = 0;
    const cuerpo = new ReadableStream<Uint8Array>({
      pull(c) {
        if (enviados++ > 10) c.close();
        else c.enqueue(trozo);
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(cuerpo, { status: 200 })));
    await expect(descargarIcs("https://www.airbnb.com/calendar/ical/1.ics")).rejects.toThrow(/demasiado grande/);
  });
});

describe.skipIf(!HAY_DB)("integración — correctitud de dinero, reservas y concurrencia", () => {
  let db: Db;
  let dueno: string;
  let principal: string;
  let externo: string;
  let admin: UsuarioSesion;

  const usuario = async (rol: string) =>
    (
      await db
        .insert(usuarios)
        .values({
          nombreReal: "Correctitud", cedulaHash: `co-${uid()}`, cedulaCifrada: "x",
          email: `co-${uid()}@t.local`, telefonoCifrado: "x", roles: [rol as "externo"], estado: "activo",
        })
        .returning({ id: usuarios.id })
    )[0].id;

  const propiedad = async () =>
    (
      await db
        .insert(propiedades)
        .values({
          propietarioId: dueno, nombre: `Correctitud ${uid()}`, municipio: "X", zona: "X",
          tipo: "finca", capacidad: 6, habitaciones: 2, banos: 2, publicada: true,
        })
        .returning({ id: propiedades.id })
    )[0].id;

  /** Reserva en LINK_1_ENVIADO con su link 1 activo ($2.000.000 / neta $1.600.000). */
  const reservaConLink1 = async (prop: string, desde: string, hasta: string) => {
    const [s] = await db.insert(solicitudes).values({
      externoId: externo, propiedadId: prop, desde, hasta, huespedes: 2, estado: "aceptada",
      principalAceptanteId: principal, venceEn: sql`now() + interval '1 day'` as unknown as Date,
    }).returning({ id: solicitudes.id });
    const [r] = await db.insert(reservas).values({
      codigo: `CO-${uid()}`, solicitudId: s.id, propiedadId: prop, principalId: principal, externoId: externo,
      desde, hasta, estado: "LINK_1_ENVIADO", precioFinalCentavos: 200_000_000, tarifaNetaCentavos: 160_000_000,
    }).returning({ id: reservas.id });
    const [l] = await db.insert(linksDePago).values({
      reservaId: r.id, mitad: 1, montoCentavos: 100_000_000, url: `/pago/co-${uid()}`,
      venceEn: sql`now() + interval '1 day'` as unknown as Date,
    }).returning({ id: linksDePago.id });
    return { reservaId: r.id, linkId: l.id, solicitudId: s.id };
  };

  const pagar = (linkId: string, monto = 100_000_000) =>
    procesarWebhookPago(db, { pasarelaRef: `co-${uid()}`, linkId, montoCentavos: monto, estado: "aprobada" });

  const estadoReserva = async (id: string) =>
    (await db.select({ e: reservas.estado }).from(reservas).where(eq(reservas.id, id)))[0].e;
  const estadoLink = async (id: string) =>
    (await db.select({ e: linksDePago.estado }).from(linksDePago).where(eq(linksDePago.id, id)))[0].e;

  /** Negociación abierta con una oferta ACTIVA del externo (reserva en NEGOCIACION). */
  const negociacionAbierta = async (prop: string, desde: string, hasta: string, monto = 200_000_000) => {
    const [s] = await db.insert(solicitudes).values({
      externoId: externo, propiedadId: prop, desde, hasta, huespedes: 2, estado: "aceptada",
      principalAceptanteId: principal, venceEn: sql`now() + interval '1 day'` as unknown as Date,
    }).returning({ id: solicitudes.id });
    const [r] = await db.insert(reservas).values({
      codigo: `CO-${uid()}`, solicitudId: s.id, propiedadId: prop, principalId: principal, externoId: externo,
      desde, hasta, estado: "NEGOCIACION", precioFinalCentavos: 0, tarifaNetaCentavos: 160_000_000,
    }).returning({ id: reservas.id });
    const [n] = await db.insert(negociaciones).values({ solicitudId: s.id, tarifaNetaCentavos: 160_000_000 })
      .returning({ id: negociaciones.id });
    const [o] = await db.insert(ofertas).values({
      negociacionId: n.id, emisorId: externo, montoCentavos: monto,
      venceEn: sql`now() + interval '6 hours'` as unknown as Date,
    }).returning({ id: ofertas.id });
    return { reservaId: r.id, negociacionId: n.id, ofertaId: o.id, solicitudId: s.id };
  };

  beforeAll(async () => {
    db = obtenerDb();
    dueno = await usuario("propietario");
    principal = await usuario("principal");
    externo = await usuario("externo");
    const a = await usuario("admin");
    admin = { id: a, email: "admin", roles: ["admin"], estado: "activo", adminElevada: true };
    await db.insert(suscripciones).values({ propietarioId: dueno, plan: "p", estado: "activa", renuevaEn: dia(400) });
  });

  // ── C1 · saldo sobre reserva CANCELADA ──────────────────────────────────────

  it("C1: la transición post-pago ocurre DENTRO de la tx del webhook (sin orquestador)", async () => {
    const prop = await propiedad();
    const { reservaId, linkId } = await reservaConLink1(prop, dia(40), dia(42));
    expect((await pagar(linkId)).resultado).toBe("procesado");
    expect(await estadoReserva(reservaId)).toBe("ANTICIPO_PAGADO");
    const aud = await db.select().from(auditoriaReservas).where(eq(auditoriaReservas.reservaId, reservaId));
    expect(aud.some((a) => a.estadoNuevo === "ANTICIPO_PAGADO" && a.actor === "webhook:pasarela")).toBe(true);
  }, 30_000);

  it("C1: un saldo expirado NO se revive sobre una reserva CANCELADA por reembolso", async () => {
    const prop = await propiedad();
    const { reservaId, linkId } = await reservaConLink1(prop, dia(44), dia(46));
    const ref = `co-c1-${uid()}`;
    await procesarWebhookPago(db, { pasarelaRef: ref, linkId, montoCentavos: 100_000_000, estado: "aprobada" });
    const saldo = await generarLinkSaldo(db, reservaId, externo);
    await db.update(linksDePago).set({ venceEn: sql`now() - interval '1 hour'` }).where(eq(linksDePago.id, saldo.linkId));
    await expirarVigencias(db);
    expect(await estadoLink(saldo.linkId)).toBe("expirado");

    const [t] = await db.select().from(transacciones).where(eq(transacciones.pasarelaRef, ref));
    await reembolsar(db, admin, t.id, "CONFIRMO REEMBOLSO");
    expect(await estadoReserva(reservaId)).toBe("CANCELADA");
    // El reembolso invalida también los links EXPIRADOS…
    expect(await estadoLink(saldo.linkId)).toBe("invalidado");
    // …y el saldo jamás se regenera sobre la reserva cancelada.
    await expect(generarLinkSaldo(db, reservaId, externo)).rejects.toThrow(SaldoError);
  }, 30_000);

  it("C1: un webhook sobre un link cuya reserva ya no espera ese pago → compensación, sin cobro aplicado", async () => {
    const prop = await propiedad();
    const { reservaId, linkId } = await reservaConLink1(prop, dia(48), dia(50));
    await pagar(linkId);
    const saldo = await generarLinkSaldo(db, reservaId, externo);
    // Estado legado: reserva CANCELADA con un link de saldo que quedó 'activo'.
    await db.update(reservas).set({ estado: "CANCELADA" }).where(eq(reservas.id, reservaId));

    const ref = `co-c1b-${uid()}`;
    const r = await procesarWebhookPago(db, {
      pasarelaRef: ref, linkId: saldo.linkId, montoCentavos: saldo.montoCentavos, estado: "aprobada",
    });
    expect(r.resultado).toBe("link_no_activo");
    expect(await estadoLink(saldo.linkId)).toBe("invalidado");
    const [comp] = await db.select().from(compensaciones).where(eq(compensaciones.pasarelaRef, ref));
    expect(comp?.motivo).toBe("reserva_no_cobrable");
    expect(comp?.reservaId).toBe(reservaId);
    const aplicadas = await db.select().from(transacciones).where(eq(transacciones.pasarelaRef, ref));
    expect(aplicadas).toHaveLength(0);
  }, 30_000);

  it("M2: un link de saldo 'activo' pero vencido se trata como expirado y se regenera", async () => {
    const prop = await propiedad();
    const { reservaId, linkId } = await reservaConLink1(prop, dia(52), dia(54));
    await pagar(linkId);
    const s1 = await generarLinkSaldo(db, reservaId, externo);
    await db.update(linksDePago).set({ venceEn: sql`now() - interval '1 minute'` }).where(eq(linksDePago.id, s1.linkId));
    const s2 = await generarLinkSaldo(db, reservaId, externo);
    expect(s2.linkId).toBe(s1.linkId);
    expect(s2.yaExistia).toBe(false);
    const [l] = await db.select().from(linksDePago).where(eq(linksDePago.id, s2.linkId));
    expect(l.estado).toBe("activo");
    expect(l.venceEn.getTime()).toBeGreaterThan(Date.now());
  }, 30_000);

  it("M7: pasado el día de check-in el saldo expirado NO se regenera", async () => {
    const prop = await propiedad();
    const { reservaId, linkId } = await reservaConLink1(prop, dia(56), dia(58));
    await pagar(linkId);
    const s1 = await generarLinkSaldo(db, reservaId, externo);
    await db.update(reservas).set({ desde: dia(-1), hasta: dia(1) }).where(eq(reservas.id, reservaId));
    await db.update(linksDePago).set({ estado: "expirado" }).where(eq(linksDePago.id, s1.linkId));
    await expect(generarLinkSaldo(db, reservaId, externo)).rejects.toThrow(/check-in ya pasó/);
  }, 30_000);

  // ── A1 · reembolso concurrente con el pago del saldo ───────────────────────

  it("A1: si el saldo entra mientras se reembolsa, el reembolso se reintenta y devuelve AMBAS mitades", async () => {
    const prop = await propiedad();
    const { reservaId, linkId } = await reservaConLink1(prop, dia(60), dia(62));
    const ref1 = `co-a1-${uid()}`;
    await procesarWebhookPago(db, { pasarelaRef: ref1, linkId, montoCentavos: 100_000_000, estado: "aprobada" });
    const saldo = await generarLinkSaldo(db, reservaId, externo);
    const [t1] = await db.select().from(transacciones).where(eq(transacciones.pasarelaRef, ref1));

    // El webhook del saldo entra JUSTO durante la FASE 2 (llamada a la pasarela).
    const pasarela = obtenerPasarela();
    const original = pasarela.reembolsar.bind(pasarela);
    let disparado = false;
    const ref2 = `co-a1b-${uid()}`;
    const espia = vi.spyOn(pasarela, "reembolsar").mockImplementation(async (ref, monto) => {
      if (!disparado) {
        disparado = true;
        const r = await procesarWebhookPago(db, {
          pasarelaRef: ref2, linkId: saldo.linkId, montoCentavos: saldo.montoCentavos, estado: "aprobada",
        });
        expect(r.resultado).toBe("procesado");
      }
      return original(ref, monto);
    });
    try {
      await reembolsar(db, admin, t1.id, "CONFIRMO REEMBOLSO");
    } finally {
      espia.mockRestore();
    }

    expect(await estadoReserva(reservaId)).toBe("CANCELADA");
    const trx = await db
      .select({ estado: transacciones.estado, ref: transacciones.pasarelaRef })
      .from(transacciones)
      .innerJoin(linksDePago, eq(linksDePago.id, transacciones.linkId))
      .where(eq(linksDePago.reservaId, reservaId));
    expect(trx).toHaveLength(2);
    expect(trx.every((t) => t.estado === "reversada")).toBe(true);
  }, 30_000);

  // ── A2 · perdedores zombi en LINK_1_ENVIADO ─────────────────────────────────

  it("A2: el competidor invalidado y el perdedor de la carrera quedan INVALIDADA (no zombis)", async () => {
    const prop = await propiedad();
    const A = await reservaConLink1(prop, dia(70), dia(74));
    const B = await reservaConLink1(prop, dia(72), dia(75)); // solapa con A
    expect((await pagar(A.linkId)).resultado).toBe("procesado");
    // B fue invalidado en 4b y su reserva transicionó en la MISMA tx
    expect(await estadoLink(B.linkId)).toBe("invalidado");
    expect(await estadoReserva(B.reservaId)).toBe("INVALIDADA");

    // C nace después con link activo sobre noches ya tomadas → pierde la carrera
    const C = await reservaConLink1(prop, dia(73), dia(76));
    expect((await pagar(C.linkId)).resultado).toBe("fechas_tomadas");
    expect(await estadoReserva(C.reservaId)).toBe("INVALIDADA");
    const [comp] = await db.select().from(compensaciones).where(eq(compensaciones.linkId, C.linkId));
    expect(comp?.motivo).toBe("fechas_tomadas");
  }, 30_000);

  it("A2: el cron rescata zombis existentes (link 1 invalidado + reserva LINK_1_ENVIADO)", async () => {
    const prop = await propiedad();
    const Z = await reservaConLink1(prop, dia(80), dia(82));
    await db.update(linksDePago).set({ estado: "invalidado" }).where(eq(linksDePago.id, Z.linkId));
    const r = await expirarVigencias(db);
    expect(r.reservasInvalidadas).toBeGreaterThanOrEqual(1);
    expect(await estadoReserva(Z.reservaId)).toBe("INVALIDADA");
  }, 30_000);

  // ── A3 · negociaciones abandonadas ──────────────────────────────────────────

  it("A3: NEGOCIACION sin oferta activa y > 48 h sin actividad → EXPIRADA y negociación cerrada", async () => {
    const prop = await propiedad();
    const vieja = await negociacionAbierta(prop, dia(90), dia(92));
    // Sin oferta viva y toda la actividad hace 3 días
    await db.update(ofertas).set({ estado: "contraofertada", creadaEn: sql`now() - interval '3 days'` })
      .where(eq(ofertas.id, vieja.ofertaId));
    await db.update(reservas).set({ creadaEn: sql`now() - interval '4 days'` }).where(eq(reservas.id, vieja.reservaId));

    const reciente = await negociacionAbierta(prop, dia(93), dia(95));
    await db.update(ofertas).set({ estado: "contraofertada" }).where(eq(ofertas.id, reciente.ofertaId));
    await db.update(reservas).set({ creadaEn: sql`now() - interval '4 days'` }).where(eq(reservas.id, reciente.reservaId));
    // (su última oferta es de hace segundos: hay actividad reciente)

    const conOferta = await negociacionAbierta(prop, dia(96), dia(98));
    await db.update(reservas).set({ creadaEn: sql`now() - interval '4 days'` }).where(eq(reservas.id, conOferta.reservaId));
    await db.update(ofertas).set({ creadaEn: sql`now() - interval '3 days'` }).where(eq(ofertas.id, conOferta.ofertaId));

    await expirarVigencias(db);
    expect(await estadoReserva(vieja.reservaId)).toBe("EXPIRADA");
    const [n] = await db.select().from(negociaciones).where(eq(negociaciones.id, vieja.negociacionId));
    expect(n.estado).toBe("expirada");
    expect(await estadoReserva(reciente.reservaId)).toBe("NEGOCIACION");
    expect(await estadoReserva(conOferta.reservaId)).toBe("NEGOCIACION");
  }, 30_000);

  // ── A4 · fechas pasadas ─────────────────────────────────────────────────────

  it("A4: no se crea, acepta ni cierra con link una solicitud con fechas pasadas", async () => {
    const prop = await propiedad();
    await expect(
      crearSolicitud(db, { externoId: externo, propiedadId: prop, desde: dia(-3), hasta: dia(-1), huespedes: 2 }),
    ).rejects.toThrow(OperacionError);

    const [s] = await db.insert(solicitudes).values({
      externoId: externo, propiedadId: prop, desde: dia(-3), hasta: dia(-1), huespedes: 2,
      venceEn: sql`now() + interval '1 hour'` as unknown as Date,
    }).returning({ id: solicitudes.id });
    await expect(aceptarYAbrirNegociacion(db, s.id, principal)).rejects.toThrow(/ya pasaron/);

    const neg = await negociacionAbierta(prop, dia(-2), dia(1));
    await expect(aceptarOfertaYGenerarLink(db, neg.ofertaId, principal)).rejects.toThrow(/ya pasaron/);
    // Nada quedó a medias: la oferta sigue activa y no hay link
    const [o] = await db.select().from(ofertas).where(eq(ofertas.id, neg.ofertaId));
    expect(o.estado).toBe("activa");
    expect(await db.select().from(linksDePago).where(eq(linksDePago.reservaId, neg.reservaId))).toHaveLength(0);
  }, 30_000);

  // ── M1 · monto distinto en el webhook ───────────────────────────────────────

  it("M1: monto distinto → compensación 'monto_no_coincide' y 200 (sin lanzar); el link sigue cobrable", async () => {
    const prop = await propiedad();
    const { reservaId, linkId } = await reservaConLink1(prop, dia(100), dia(102));
    const ref = `co-m1-${uid()}`;
    const r = await procesarWebhookPago(db, { pasarelaRef: ref, linkId, montoCentavos: 99_999_900, estado: "aprobada" });
    expect(r.resultado).toBe("monto_no_coincide");
    const [comp] = await db.select().from(compensaciones).where(eq(compensaciones.pasarelaRef, ref));
    expect(comp?.motivo).toBe("monto_no_coincide");
    expect(await estadoLink(linkId)).toBe("activo");
    expect(await estadoReserva(reservaId)).toBe("LINK_1_ENVIADO");
    expect((await pagar(linkId)).resultado).toBe("procesado");
  }, 30_000);

  // ── M3 · verificación de calendario antes del link 1 ────────────────────────

  it("M3: no se emite el link 1 si alguna noche ya está bloqueada (sin holds)", async () => {
    const prop = await propiedad();
    const neg = await negociacionAbierta(prop, dia(110), dia(113));
    await db.insert(calendarioDias).values({ propiedadId: prop, fecha: dia(111), estado: "bloqueado_manual" });
    await expect(aceptarOfertaYGenerarLink(db, neg.ofertaId, principal)).rejects.toThrow(OfertaNoAceptableError);
    expect(await estadoReserva(neg.reservaId)).toBe("NEGOCIACION");
    // Back-to-back: el día de salida ocupado NO impide (noches semiabiertas)
    const neg2 = await negociacionAbierta(prop, dia(114), dia(116));
    await db.insert(calendarioDias).values({ propiedadId: prop, fecha: dia(116), estado: "reservado_app" });
    const ok = await aceptarOfertaYGenerarLink(db, neg2.ofertaId, principal);
    expect(ok.montoCentavos).toBe(100_000_000);
  }, 30_000);

  // ── M5 · deadlock aceptar vs contraofertar ──────────────────────────────────

  it("M5: aceptar y contraofertar a la vez jamás deadlockean — exactamente uno gana", async () => {
    const prop = await propiedad();
    for (let i = 0; i < 6; i++) {
      const neg = await negociacionAbierta(prop, dia(120 + i * 3), dia(121 + i * 3));
      const [acepta, contra] = await Promise.allSettled([
        aceptarOfertaYGenerarLink(db, neg.ofertaId, principal),
        contraofertar(db, neg.negociacionId, principal, 210_000_000),
      ]);
      for (const r of [acepta, contra]) {
        if (r.status === "rejected") {
          expect(String((r.reason as { code?: string }).code ?? "")).not.toBe("40P01");
          expect(r.reason instanceof OfertaNoAceptableError || r.reason instanceof OperacionError).toBe(true);
        }
      }
      expect([acepta.status, contra.status].filter((s) => s === "fulfilled")).toHaveLength(1);
    }
  }, 60_000);

  // ── M4 · iCal: reemplazo del conjunto, rango y un solo SQL ──────────────────

  it("M4: la sync reemplaza bloqueado_ical (libera lo que ya no viene) y recorta el rango", async () => {
    const prop = await propiedad();
    await db.insert(calendarioDias).values([
      { propiedadId: prop, fecha: dia(5), estado: "bloqueado_ical" }, // ya no viene → se libera
      { propiedadId: prop, fecha: dia(10), estado: "bloqueado_ical" }, // sigue viniendo
      { propiedadId: prop, fecha: dia(6), estado: "bloqueado_manual" }, // jamás lo toca iCal
      { propiedadId: prop, fecha: dia(11), estado: "reservado_app" }, // conflicto → alerta
    ]);
    const ev = (a: string, b: string) =>
      `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${ymd(a)}\r\nDTEND;VALUE=DATE:${ymd(b)}\r\nEND:VEVENT`;
    const ics = [
      "BEGIN:VCALENDAR",
      ev(dia(-2), dia(1)), // pasado recortado: solo hoy
      ev(dia(10), dia(12)), // 10 (ya estaba) + 11 (conflicto)
      ev(dia(600), dia(602)), // > 18 meses: fuera del horizonte
      "END:VCALENDAR",
    ].join("\r\n");

    // Una sola fuente sin reemplazo (importarIcs): agrega, no libera.
    const r1 = await importarIcs(db, prop, ics, "airbnb");
    expect(r1.diasLiberados).toBe(0);
    expect(r1.conflictos).toBe(1);

    const r2 = await sincronizarIcalPropiedad(db, prop, [ics], { reemplazar: true });
    expect(r2.diasLiberados).toBe(1);

    const dias = await db.select().from(calendarioDias).where(eq(calendarioDias.propiedadId, prop));
    const estado = (f: string) => dias.find((d) => d.fecha === f)?.estado;
    expect(estado(dia(5))).toBe("disponible");
    expect(estado(dia(10))).toBe("bloqueado_ical");
    expect(estado(dia(6))).toBe("bloqueado_manual");
    expect(estado(dia(11))).toBe("reservado_app");
    expect(estado(dia(0))).toBe("bloqueado_ical");
    expect(estado(dia(-1))).toBeUndefined();
    expect(estado(dia(600))).toBeUndefined();
  }, 30_000);

  // ── Escala: purga de auth y bloqueo multi-fila ──────────────────────────────

  it("vigencias purga sesiones y OTPs vencidos hace > 1 día (y respeta los recientes)", async () => {
    const vieja = `co-ses-${uid()}`;
    const reciente = `co-ses-${uid()}`;
    await db.insert(sesiones).values([
      { tokenHash: vieja, usuarioId: externo, venceEn: sql`now() - interval '2 days'` as unknown as Date },
      { tokenHash: reciente, usuarioId: externo, venceEn: sql`now() - interval '1 hour'` as unknown as Date },
    ]);
    const email = `co-otp-${uid()}@t.local`;
    await db.insert(otps).values([
      { email, codigoHash: "x", venceEn: sql`now() - interval '3 days'` as unknown as Date },
      { email, codigoHash: "y", venceEn: sql`now() + interval '5 minutes'` as unknown as Date },
    ]);
    const r = await expirarVigencias(db);
    expect(r.sesionesPurgadas).toBeGreaterThanOrEqual(1);
    expect(r.otpsPurgados).toBeGreaterThanOrEqual(1);
    const ses = await db.select().from(sesiones).where(sql`${sesiones.tokenHash} IN (${vieja}, ${reciente})`);
    expect(ses.map((s) => s.tokenHash)).toEqual([reciente]);
    const o = await db.select().from(otps).where(eq(otps.email, email));
    expect(o.map((x) => x.codigoHash)).toEqual(["y"]);
  }, 30_000);

  it("bloquearDias: un solo INSERT multi-fila, tolera duplicados y respeta intocables", async () => {
    const prop = await propiedad();
    await db.insert(calendarioDias).values({ propiedadId: prop, fecha: dia(30), estado: "reservado_app" });
    const n = await bloquearDias(db, dueno, prop, [dia(28), dia(28), dia(29), dia(30)]);
    expect(n).toBe(2);
    const [d30] = await db.select().from(calendarioDias)
      .where(and(eq(calendarioDias.propiedadId, prop), eq(calendarioDias.fecha, dia(30))));
    expect(d30.estado).toBe("reservado_app");
  }, 30_000);

  // ── Seguridad: contrato para admin exige sesión ELEVADA ─────────────────────

  it("puedeVerContrato: admin solo con sesión elevada (TOTP); un id suelto no autoriza admin", async () => {
    const prop = await propiedad();
    const { reservaId } = await reservaConLink1(prop, dia(130), dia(131));
    expect(await puedeVerContrato(db, dueno, reservaId)).toBe(true);
    expect(await puedeVerContrato(db, admin.id, reservaId)).toBe(false);
    expect(await puedeVerContrato(db, { ...admin, adminElevada: false }, reservaId)).toBe(false);
    expect(await puedeVerContrato(db, admin, reservaId)).toBe(true);
    expect(await puedeVerContrato(db, principal, reservaId)).toBe(false);
  }, 30_000);
});
