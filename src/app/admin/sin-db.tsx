import { Card } from "@/components/ui";

/** Estado del panel cuando no hay DATABASE_URL (demo pública en Vercel). */
export function SinDb({ seccion }: { seccion: string }) {
  return (
    <Card className="p-8 text-sm leading-relaxed text-bruma">
      <p className="font-semibold text-oro">Base de datos no conectada.</p>
      <p className="mt-2">
        La consola de {seccion} opera contra Postgres real. En local:{" "}
        <code className="cifra text-xs text-esmeralda">docs/demo.md</code> (4 comandos con
        Docker). En producción: configurar <code className="cifra text-xs">DATABASE_URL</code>{" "}
        siguiendo <code className="cifra text-xs">docs/credenciales-necesarias.md</code>.
      </p>
    </Card>
  );
}

export function hayDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
