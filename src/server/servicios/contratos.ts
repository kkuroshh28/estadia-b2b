import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { contratos, contratosBlob, propiedades, reservas, usuarios } from "../db/schema";
import { formatear, centavos } from "@/lib/dinero";
import { nochesEntre } from "@/lib/domain/reglas";
import { formatearFechaCO } from "@/lib/fechas";

/**
 * Contratos PDF (Fase 6): generación automática al confirmarse el Pago 1.
 * - Plantilla por duración: <30 noches vivienda turística; 30–92 mediano plazo.
 * - Identidades REALES solo dentro del documento (jamás en la UI entre alias).
 * - Hash SHA-256 almacenado; el PDF vive en contratos_blob.
 * - Acceso: SOLO propietario y admin (los comisionistas NO son parte).
 */

export async function generarContrato(
  db: Db,
  reservaId: string,
  nombreHuesped = "(Cliente final — lo completa el externo en el flujo real)",
): Promise<{ contratoId: string; tipo: string; hash: string }> {
  const [existente] = await db.select().from(contratos).where(eq(contratos.reservaId, reservaId));
  if (existente) return { contratoId: existente.id, tipo: existente.tipo, hash: existente.hashSha256 };

  const [r] = await db.select().from(reservas).where(eq(reservas.id, reservaId));
  if (!r) throw new Error("Reserva no encontrada");
  const [prop] = await db.select().from(propiedades).where(eq(propiedades.id, r.propiedadId));
  const [dueno] = await db.select().from(usuarios).where(eq(usuarios.id, prop.propietarioId));

  const noches = nochesEntre(r.desde, r.hasta);
  const tipo = noches < 30 ? "vivienda_turistica" : "arrendamiento_corto";
  const plantilla = readFileSync(
    join(
      process.cwd(),
      "plantillas",
      tipo === "vivienda_turistica" ? "contrato-vivienda-turistica.txt" : "contrato-mediano-plazo.txt",
    ),
    "utf8",
  );

  const texto = plantilla
    .replaceAll("{{codigo}}", r.codigo)
    .replaceAll("{{fecha_generacion}}", formatearFechaCO(new Date().toISOString().slice(0, 10), { day: "numeric", month: "long", year: "numeric" }))
    .replaceAll("{{nombre_propietario}}", dueno.nombreReal)
    .replaceAll("{{nombre_propiedad}}", prop.nombre)
    .replaceAll("{{municipio}}", prop.municipio)
    .replaceAll("{{rnt}}", "(pendiente)")
    .replaceAll("{{nombre_huesped}}", nombreHuesped)
    .replaceAll("{{fecha_entrada}}", formatearFechaCO(r.desde, { day: "numeric", month: "long", year: "numeric" }))
    .replaceAll("{{fecha_salida}}", formatearFechaCO(r.hasta, { day: "numeric", month: "long", year: "numeric" }))
    .replaceAll("{{noches}}", String(noches))
    .replaceAll("{{huespedes}}", String(prop.capacidad))
    .replaceAll("{{precio_total}}", formatear(centavos(r.precioFinalCentavos)))
    .replaceAll("{{reglas}}", prop.reglas.join("; ") || "Las publicadas en la ficha.");

  // PDF
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const lineas = texto.replaceAll("{{hash}}", "(se estampa tras el cálculo)").split("\n");
  let pagina = doc.addPage([595, 842]); // A4
  let y = 800;
  for (const linea of lineas) {
    for (const trozo of partir(linea, 95)) {
      if (y < 40) {
        pagina = doc.addPage([595, 842]);
        y = 800;
      }
      pagina.drawText(trozo, { x: 40, y, size: 9, font: fuente });
      y -= 13;
    }
  }
  const bytes = await doc.save();
  const hash = createHash("sha256").update(bytes).digest("hex");

  const [c] = await db
    .insert(contratos)
    .values({ reservaId, tipo, pdfUrl: `db://contratos_blob`, hashSha256: hash })
    .returning({ id: contratos.id });
  await db.insert(contratosBlob).values({
    contratoId: c.id,
    bytesBase64: Buffer.from(bytes).toString("base64"),
  });
  return { contratoId: c.id, tipo, hash };
}

/**
 * Acceso al contrato: SOLO el propietario del inmueble (parte legal) o admin.
 * Los comisionistas —principal o externo— JAMÁS: preservar el anonimato es la regla.
 */
export async function puedeVerContrato(db: Db, usuarioId: string, reservaId: string): Promise<boolean> {
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId));
  if (u?.roles.includes("admin")) return true;
  const [r] = await db.select().from(reservas).where(eq(reservas.id, reservaId));
  if (!r) return false;
  const [prop] = await db.select().from(propiedades).where(eq(propiedades.id, r.propiedadId));
  return prop?.propietarioId === usuarioId;
}

function partir(linea: string, ancho: number): string[] {
  if (linea.length <= ancho) return [linea];
  const partes: string[] = [];
  let actual = "";
  for (const palabra of linea.split(" ")) {
    if ((actual + " " + palabra).trim().length > ancho) {
      partes.push(actual.trim());
      actual = palabra;
    } else {
      actual = `${actual} ${palabra}`;
    }
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
}
