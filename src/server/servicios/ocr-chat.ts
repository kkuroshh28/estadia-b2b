import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { mensajesChat } from "../db/schema";
import { obtenerOcr } from "../adaptadores/ocr";
import { procesarMensaje } from "./antifuga";

/**
 * OCR anti-fuga (§7.3): una imagen del chat queda "en_revision" y NO se
 * entrega hasta pasar el filtro. Si el texto extraído contiene contacto,
 * corre el MISMO flujo de strikes/ban del texto.
 */
export async function recibirImagenChat(
  db: Db,
  emisorId: string,
  reservaId: string | null,
  imagen: Buffer,
): Promise<{ mensajeId: string; estado: "aprobado" | "bloqueado" }> {
  const [m] = await db
    .insert(mensajesChat)
    .values({
      reservaId,
      emisorId,
      contenido: "[imagen]",
      ocrEstado: "en_revision", // no se entrega todavía
    })
    .returning({ id: mensajesChat.id });

  // En producción esto corre en cola (Inngest); el resultado es idéntico.
  const texto = await obtenerOcr().extraerTexto(imagen);
  const veredicto = await procesarMensaje(db, emisorId, texto);

  const estado = veredicto.veredicto === "permitido" ? "aprobado" : "bloqueado";
  await db
    .update(mensajesChat)
    .set({
      ocrEstado: estado,
      bloqueado: estado === "bloqueado",
      flags: estado === "bloqueado" ? (veredicto as { motivos: string[] }).motivos : [],
    })
    .where(eq(mensajesChat.id, m.id));

  return { mensajeId: m.id, estado };
}
