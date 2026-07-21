/**
 * Seed de datos realistas del piloto Oriente Antioqueño.
 * Uso: DATABASE_URL=... npm run db:seed
 * Idempotente por marca: aborta si ya existe el propietario semilla.
 * Las "fotos" son carátulas generadas por la app (sin activos de terceros).
 */
import { sql } from "drizzle-orm";
import { obtenerDb } from "./index";
import {
  calendarioDias,
  configuracionPlataforma,
  negociaciones,
  ofertas,
  propiedades,
  reservas,
  solicitudes,
  suscripciones,
  tarifas,
  usuarios,
  vinculosComisionista,
  linksDePago,
} from "./schema";
import { asignarAliasUnico } from "../servicios/alias";
import { procesarWebhookPago, transicionPostPago } from "../servicios/pagos";

const MUNICIPIOS: [string, string][] = [
  ["Guatapé", "Oriente Antioqueño"], ["El Peñol", "Oriente Antioqueño"],
  ["San Jerónimo", "Occidente cercano"], ["Santa Fe de Antioquia", "Occidente cercano"],
  ["Medellín", "El Poblado"], ["Medellín", "Laureles–Estadio"],
  ["Rionegro", "Oriente cercano"], ["El Retiro", "Oriente cercano"],
  ["Jardín", "Suroeste"], ["Guatapé", "Oriente Antioqueño"],
  ["San Jerónimo", "Occidente cercano"], ["Medellín", "El Poblado"],
];

const NOMBRES = [
  "Finca Mirador del Peñol", "Casa del Embalse", "Finca La Cascada",
  "Casona Colonial Santa Fe", "Penthouse Provenza 1102", "Apartamento Laureles 501",
  "Casa Campestre Llanogrande", "Glamping Bosque Nublado", "Finca Cafetera La Loma",
  "Chalet de la Represa", "Finca Los Tamarindos", "Loft Manila 804",
];

// Tarifas neta/noche en CENTAVOS ($520.000 – $2.400.000)
const TARIFAS = [
  145_000_000, 98_000_000, 115_000_000, 89_000_000, 98_000_000, 52_000_000,
  115_000_000, 62_000_000, 89_000_000, 240_000_000, 132_000_000, 74_000_000,
];

async function main() {
  const db = obtenerDb();

  const yaExiste = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(sql`email = 'demo.propietario1@estadia.demo'`)
    .limit(1);
  if (yaExiste.length > 0) {
    console.log("Seed ya aplicado — no se duplica.");
    return;
  }

  // Config base
  await db.insert(configuracionPlataforma).values([
    { clave: "piso_comision", valor: { activo: false, pct: 0.08 } },
    { clave: "vigencias", valor: { solicitud_min: 30, oferta_horas: 6, link_horas: 24, saldo_anticipacion_horas: 36 } },
    { clave: "split", valor: { principal: 0.5, externo: 0.4, app: 0.1 } },
  ]).onConflictDoNothing();

  // 3 propietarios + 8 comisionistas (3 principales, 5 externos)
  const crearUsuario = async (rol: "propietario" | "principal" | "externo", n: number) => {
    const [u] = await db.insert(usuarios).values({
      nombreReal: `Demo ${rol} ${n}`,
      cedulaHash: `demo-${rol}-${n}`,
      cedulaCifrada: "demo",
      email: `demo.${rol}${n}@estadia.demo`,
      telefonoCifrado: "demo",
      roles: [rol],
      estado: "activo",
    }).returning({ id: usuarios.id });
    return u.id;
  };

  const propietarios = [
    await crearUsuario("propietario", 1),
    await crearUsuario("propietario", 2),
    await crearUsuario("propietario", 3),
  ];
  const principales = [
    await crearUsuario("principal", 1),
    await crearUsuario("principal", 2),
    await crearUsuario("principal", 3),
  ];
  const externos = await Promise.all(
    [1, 2, 3, 4, 5].map((n) => crearUsuario("externo", n)),
  );
  for (const id of [...principales, ...externos]) {
    console.log(`alias ${await asignarAliasUnico(db, id)} → ${id.slice(0, 8)}`);
  }

  // Suscripciones activas (regla #3)
  for (const p of propietarios) {
    await db.insert(suscripciones).values({
      propietarioId: p, plan: "piloto", estado: "activa", renuevaEn: "2026-08-01",
    });
  }

  // 12 propiedades con tarifa, calendario ago-sep y 3-4 principales vinculados
  const propIds: string[] = [];
  for (let i = 0; i < 12; i++) {
    const [m, z] = MUNICIPIOS[i];
    const [p] = await db.insert(propiedades).values({
      propietarioId: propietarios[i % 3],
      nombre: NOMBRES[i],
      municipio: m,
      zona: z,
      tipo: i % 4 === 0 ? "finca" : i % 4 === 1 ? "casa" : i % 4 === 2 ? "apartamento" : "glamping",
      capacidad: 2 + (i % 6) * 2,
      habitaciones: 1 + (i % 5),
      banos: 1 + (i % 4),
      amenidades: ["Piscina", "BBQ", "WiFi", "Parqueadero"].slice(0, 2 + (i % 3)),
      reglas: ["No fiestas después de 11 pm", "Check-in 3 pm"],
      verificada: i !== 8, // una en revisión
      publicada: true,
    }).returning({ id: propiedades.id });
    propIds.push(p.id);

    await db.insert(tarifas).values({
      propiedadId: p.id, desde: "2026-07-01", hasta: "2026-12-31",
      netaNocheCentavos: TARIFAS[i],
    });

    // Agosto-septiembre 2026: ocupación variada (~20% bloqueado)
    for (let d = 1; d <= 61; d++) {
      const fecha = d <= 31 ? `2026-08-${String(d).padStart(2, "0")}` : `2026-09-${String(d - 31).padStart(2, "0")}`;
      const estado = (d + i) % 11 === 0 ? "bloqueado_manual" : (d + i) % 13 === 0 ? "bloqueado_ical" : "disponible";
      await db.insert(calendarioDias).values({ propiedadId: p.id, fecha, estado });
    }

    for (let k = 0; k < 3 + (i % 2); k++) {
      await db.insert(vinculosComisionista).values({
        propiedadId: p.id, principalId: principales[(i + k) % 3],
      }).onConflictDoNothing();
    }
  }

  // Una reserva COMPLETA vía el motor real: solicitud → reserva → link → webhook
  const [sol] = await db.insert(solicitudes).values({
    externoId: externos[0], propiedadId: propIds[0],
    desde: "2026-08-14", hasta: "2026-08-17", huespedes: 10,
    estado: "aceptada", principalAceptanteId: principales[0],
    venceEn: sql`now() + interval '1 day'` as unknown as Date,
  }).returning({ id: solicitudes.id });
  const [res] = await db.insert(reservas).values({
    codigo: "EST-2026-00401", solicitudId: sol.id, propiedadId: propIds[0],
    principalId: principales[0], externoId: externos[0],
    desde: "2026-08-14", hasta: "2026-08-17", estado: "LINK_1_ENVIADO",
    precioFinalCentavos: 510_000_000, tarifaNetaCentavos: 435_000_000,
  }).returning({ id: reservas.id });
  const [lnk] = await db.insert(linksDePago).values({
    reservaId: res.id, mitad: 1, montoCentavos: 255_000_000,
    url: `/pago/seed-${res.id}`, venceEn: sql`now() + interval '1 day'` as unknown as Date,
  }).returning({ id: linksDePago.id });
  const r = await procesarWebhookPago(db, {
    pasarelaRef: "seed-pago-1", linkId: lnk.id, montoCentavos: 255_000_000, estado: "aprobada",
  });
  if (r.resultado === "procesado") await transicionPostPago(db, res.id, 1);
  console.log(`reserva semilla EST-2026-00401 → ${r.resultado} (splits reales en DB)`);

  // Una negociación EN CURSO con dos ofertas
  const [sol2] = await db.insert(solicitudes).values({
    externoId: externos[0], propiedadId: propIds[1],
    desde: "2026-08-21", hasta: "2026-08-23", huespedes: 6,
    estado: "aceptada", principalAceptanteId: principales[0],
    venceEn: sql`now() + interval '1 day'` as unknown as Date,
  }).returning({ id: solicitudes.id });
  await db.insert(reservas).values({
    codigo: "EST-2026-00402", solicitudId: sol2.id, propiedadId: propIds[1],
    principalId: principales[0], externoId: externos[0],
    desde: "2026-08-21", hasta: "2026-08-23", estado: "NEGOCIACION",
    precioFinalCentavos: 0, tarifaNetaCentavos: 196_000_000,
  });
  const [neg] = await db.insert(negociaciones).values({
    solicitudId: sol2.id, tarifaNetaCentavos: 196_000_000,
  }).returning({ id: negociaciones.id });
  await db.insert(ofertas).values([
    {
      negociacionId: neg.id, emisorId: externos[0], montoCentavos: 220_000_000,
      estado: "contraofertada", venceEn: sql`now() + interval '6 hours'` as unknown as Date,
    },
    {
      negociacionId: neg.id, emisorId: principales[0], montoCentavos: 232_000_000,
      estado: "activa", venceEn: sql`now() + interval '6 hours'` as unknown as Date,
    },
  ]);

  console.log("Seed aplicado: 3 propietarios, 8 comisionistas, 12 propiedades, reserva pagada + negociación en curso.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
