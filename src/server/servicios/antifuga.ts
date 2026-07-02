import { eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { intentosFuga, listaNegraIdentidad, usuarios, alias as tablaAlias } from "../db/schema";
import { filtrarMensaje, type ResultadoFiltro } from "@/lib/domain/antifuga";
import { retirarAlias } from "./alias";

export const MAX_STRIKES = 3;

/**
 * ANTI-FUGA EN SERVIDOR — el filtro del cliente es solo UX inmediata.
 * Todo mensaje pasa por AQUÍ antes de persistir/entregar: un cliente
 * modificado no puede saltárselo.
 */
export function validarContenidoServidor(texto: string): ResultadoFiltro {
  return filtrarMensaje(texto);
}

export type VeredictoMensaje =
  | { veredicto: "permitido" }
  | { veredicto: "bloqueado"; motivos: string[]; strikes: number; baneado: boolean };

/**
 * Valida, registra el intento como evidencia y ejecuta el ban automático al
 * tercer strike: usuario baneado + alias retirado para siempre + identidad
 * (hash de cédula + id biométrico) a la lista negra permanente.
 */
export async function procesarMensaje(
  db: Db,
  usuarioId: string,
  texto: string,
): Promise<VeredictoMensaje> {
  const filtro = validarContenidoServidor(texto);
  if (!filtro.bloqueado) return { veredicto: "permitido" };

  return await db.transaction(async (tx) => {
    await tx.insert(intentosFuga).values({
      usuarioId,
      evidencia: { texto, motivos: filtro.motivos },
      accion: "bloqueado",
    });

    const [{ strikes }] = await tx
      .select({ strikes: sql<number>`count(*)::int` })
      .from(intentosFuga)
      .where(eq(intentosFuga.usuarioId, usuarioId));

    let baneado = false;
    if (strikes >= MAX_STRIKES) {
      baneado = true;
      const [usuario] = await tx
        .select()
        .from(usuarios)
        .where(eq(usuarios.id, usuarioId))
        .for("update");

      if (usuario && usuario.estado !== "baneado") {
        await tx
          .update(usuarios)
          .set({ estado: "baneado" })
          .where(eq(usuarios.id, usuarioId));

        // Ban A LA IDENTIDAD, no a la cuenta
        await tx
          .insert(listaNegraIdentidad)
          .values({
            cedulaHash: usuario.cedulaHash,
            biometriaProveedorId: usuario.kycProveedorId,
            motivo: `Anti-fuga: ${MAX_STRIKES} intentos de intercambio de contacto`,
            evidencia: { ultimoTexto: texto, motivos: filtro.motivos },
          })
          .onConflictDoNothing();

        // Alias retirado para siempre (jamás se reasigna)
        const filas = await tx
          .select({ alias: tablaAlias.alias })
          .from(tablaAlias)
          .where(eq(tablaAlias.usuarioId, usuarioId));
        for (const f of filas) await retirarAlias(tx as unknown as Db, f.alias);

        await tx.insert(intentosFuga).values({
          usuarioId,
          evidencia: { texto, motivos: filtro.motivos },
          accion: "ban_perpetuo",
        });
      }
    }

    return { veredicto: "bloqueado", motivos: filtro.motivos, strikes, baneado };
  });
}

/**
 * Gate del re-registro: el callback del KYC compara la identidad verificada
 * contra la lista negra. Un baneado con otro correo se detecta y rechaza AQUÍ.
 */
export async function identidadBaneada(db: Db, cedulaHash: string): Promise<boolean> {
  const filas = await db
    .select({ c: listaNegraIdentidad.cedulaHash })
    .from(listaNegraIdentidad)
    .where(eq(listaNegraIdentidad.cedulaHash, cedulaHash))
    .limit(1);
  return filas.length > 0;
}
