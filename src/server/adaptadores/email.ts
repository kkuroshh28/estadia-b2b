import type { Db } from "../db";
import { notificacionesDev } from "../db/schema";

/**
 * Adaptador de email. Driver por env EMAIL_DRIVER: "simulado" (default —
 * bandeja visible en /admin/dev y consola) | "resend" (real, requiere
 * RESEND_API_KEY; se enciende SIN tocar código).
 */
export interface AdaptadorEmail {
  enviar(db: Db, destinatario: string, asunto: string, cuerpo: string): Promise<void>;
}

const simulado: AdaptadorEmail = {
  async enviar(db, destinatario, asunto, cuerpo) {
    await db.insert(notificacionesDev).values({ canal: "email", destinatario, asunto, cuerpo });
    console.log(`[email simulado] → ${destinatario} · ${asunto}\n${cuerpo}`);
  },
};

const resend: AdaptadorEmail = {
  async enviar(_db, destinatario, asunto, cuerpo) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_REMITENTE ?? "ESTADÍA <notificaciones@estadia.app>",
        to: [destinatario],
        subject: asunto,
        text: cuerpo,
      }),
    });
    if (!res.ok) throw new Error(`Resend falló: ${res.status} ${await res.text()}`);
  },
};

export function obtenerEmail(): AdaptadorEmail {
  return (process.env.EMAIL_DRIVER ?? "simulado") === "resend" ? resend : simulado;
}
