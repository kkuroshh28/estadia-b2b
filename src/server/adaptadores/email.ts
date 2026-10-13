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
    // Solo destinatario + asunto: el CUERPO puede llevar un OTP y jamás va a logs.
    console.log(`[email simulado] → ${destinatario} · ${asunto}`);
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
        from: process.env.EMAIL_REMITENTE ?? "THE CIRCLE <notificaciones@thecircle.app>",
        to: [destinatario],
        subject: asunto,
        text: cuerpo,
      }),
      // Un proveedor colgado jamás retiene la función: 5 s y se aborta.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Resend falló: ${res.status} ${await res.text()}`);
  },
};

export function obtenerEmail(): AdaptadorEmail {
  return (process.env.EMAIL_DRIVER ?? "simulado") === "resend" ? resend : simulado;
}
