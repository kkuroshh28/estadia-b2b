/**
 * Importa el portafolio PROPIO del fundador (data/portafolio-kurosh.json):
 * crea su usuario propietario y sus propiedades con ficha, fotos y videos.
 *
 * Uso:
 *   DATABASE_URL=... ENCRYPTION_KEY=... HASH_PEPPER=... \
 *   PORTAFOLIO_NOMBRE="..." PORTAFOLIO_EMAIL=... PORTAFOLIO_PASSWORD=... \
 *   [PORTAFOLIO_CEDULA=... PORTAFOLIO_TELEFONO=...] \
 *   npm run db:importar-portafolio
 *
 * El fundador es SUPERADMIN: todos los roles + acceso por contraseña.
 * Cédula/teléfono son opcionales (sin papeleos); si faltan quedan como
 * pendientes y se pueden completar después.
 *
 * Idempotente: el usuario se busca por email y cada propiedad por su slug;
 * volver a correrlo actualiza la ficha sin duplicar ni tocar tarifas,
 * calendario ni publicación.
 *
 * Reglas del portafolio:
 * - Gestión directa (Owner Direct): solo el dueño atiende y negocia.
 * - Nacen NO publicadas y sin tarifa: se publican cuando el dueño define su
 *   tarifa neta (el servicio de edición exige tarifa vigente para publicar).
 * - verificada=true: son del fundador (superadmin) — no pasan por el
 *   pipeline documental de terceros.
 * - La dirección exacta va cifrada (Anexo II), nunca en la ficha pública.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { obtenerDb } from "./index";
import { propiedades, suscripciones, usuarios } from "./schema";
import { cifrar, hashCedula, hashPassword } from "../crypto";
import { asegurarAlias } from "../servicios/alias";

interface PropiedadPortafolio {
  slug: string;
  nombre: string;
  tipo: "finca" | "apartamento" | "casa" | "glamping";
  municipio: string;
  zona: string;
  departamento: string | null;
  ubicacionPublica: string;
  direccion?: string;
  capacidad: number;
  huespedesIncluidos: number | null;
  habitaciones: number;
  banos: number;
  resumen: string;
  descripcion: string;
  nota: string;
  datosClave: { valor: string; etiqueta: string }[];
  secciones: { titulo: string; items: string[] }[];
  amenidades: string[];
  reglas: string[];
  fotos: string[];
  videos: string[];
}

function requerida(nombre: string): string {
  const v = process.env[nombre]?.trim();
  if (!v) throw new Error(`Falta la variable ${nombre}.`);
  return v;
}

const ROLES_SUPERADMIN = ["propietario", "principal", "externo", "admin"] as const;

async function main() {
  const db = obtenerDb();
  const email = requerida("PORTAFOLIO_EMAIL").toLowerCase();
  const password = process.env.PORTAFOLIO_PASSWORD;
  if (password !== undefined && password.length < 12) {
    throw new Error("PORTAFOLIO_PASSWORD debe tener al menos 12 caracteres.");
  }
  const portafolio = JSON.parse(
    readFileSync(join(process.cwd(), "data/portafolio-kurosh.json"), "utf8"),
  ) as PropiedadPortafolio[];

  const resultado = await db.transaction(async (tx) => {
    // 1. Usuario superadmin del fundador (se crea una sola vez).
    let [u] = await tx.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email));
    let creado = false;
    if (!u) {
      const cedula = process.env.PORTAFOLIO_CEDULA?.trim() || `PENDIENTE:${email}`;
      [u] = await tx
        .insert(usuarios)
        .values({
          nombreReal: requerida("PORTAFOLIO_NOMBRE"),
          cedulaHash: hashCedula(cedula),
          cedulaCifrada: cifrar(cedula),
          email,
          telefonoCifrado: cifrar(process.env.PORTAFOLIO_TELEFONO?.trim() || "PENDIENTE"),
          roles: [...ROLES_SUPERADMIN],
          estado: "activo",
        })
        .returning({ id: usuarios.id });
      creado = true;
    }
    await tx
      .update(usuarios)
      .set({
        roles: [...ROLES_SUPERADMIN],
        estado: "activo",
        ...(password ? { passwordHash: hashPassword(password) } : {}),
      })
      .where(eq(usuarios.id, u.id));

    // 2. Propiedades por slug: alta o actualización de la ficha.
    let altas = 0;
    let actualizadas = 0;
    for (const p of portafolio) {
      const ficha = {
        nombre: p.nombre,
        municipio: p.municipio,
        zona: p.zona,
        tipo: p.tipo,
        capacidad: p.capacidad,
        habitaciones: p.habitaciones,
        banos: p.banos,
        huespedesIncluidos: p.huespedesIncluidos,
        amenidades: p.amenidades.slice(0, 12),
        reglas: p.reglas.slice(0, 12),
        departamento: p.departamento,
        ubicacionPublica: p.ubicacionPublica,
        resumen: p.resumen,
        descripcion: p.descripcion,
        nota: p.nota || null,
        datosClave: p.datosClave,
        secciones: p.secciones,
        fotos: p.fotos,
        videos: p.videos,
        direccionCifrada: p.direccion ? cifrar(p.direccion) : null,
      };
      const [existente] = await tx
        .select({ id: propiedades.id, propietarioId: propiedades.propietarioId })
        .from(propiedades)
        .where(eq(propiedades.slug, p.slug));
      if (existente) {
        if (existente.propietarioId !== u.id) {
          throw new Error(`La propiedad ${p.slug} pertenece a otro usuario — no se toca.`);
        }
        await tx.update(propiedades).set({ ...ficha, verificada: true }).where(eq(propiedades.id, existente.id));
        actualizadas++;
      } else {
        await tx.insert(propiedades).values({
          ...ficha,
          slug: p.slug,
          propietarioId: u.id,
          ownerDirect: true,
          publicada: false,
          verificada: true,
        });
        altas++;
      }
    }

    // 3. Suscripción del piloto (sin cobro), como en cualquier alta.
    const [sus] = await tx.select({ id: suscripciones.id }).from(suscripciones).where(eq(suscripciones.propietarioId, u.id));
    if (!sus) {
      const renueva = new Date();
      renueva.setMonth(renueva.getMonth() + 1);
      await tx.insert(suscripciones).values({
        propietarioId: u.id,
        plan: "piloto",
        estado: "activa",
        renuevaEn: renueva.toISOString().slice(0, 10),
      });
    }

    return { usuarioId: u.id, creado, altas, actualizadas };
  });

  // Identidad protegida (Anexo II): el dueño también opera con alias.
  const alias = await asegurarAlias(db, resultado.usuarioId);

  console.log(
    `Portafolio importado — usuario ${resultado.creado ? "creado" : "existente"} (${alias}), ` +
      `${resultado.altas} propiedades nuevas, ${resultado.actualizadas} actualizadas.`,
  );
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
