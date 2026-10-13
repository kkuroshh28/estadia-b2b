import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexión por entorno (dev/staging/prod tienen DATABASE_URL distintas y
 * bases SEPARADAS — ver docs/ARQUITECTURA.md §3).
 * `prepare: false` por compatibilidad con el pooler de Neon (PgBouncer en modo
 * transaction). En serverless cada instancia es un proceso: pool CHICO por
 * instancia (el pooler de Neon multiplexa), conexiones ociosas se sueltan
 * rápido y se reciclan para no morir con el pooler.
 */
const url = process.env.DATABASE_URL;

// Pool ÚNICO por proceso, cacheado en globalThis: sobrevive el hot-reload de
// dev y evita crear un pool por petición (agotaría las conexiones de Postgres).
const globalPool = globalThis as unknown as { __estadiaDb?: ReturnType<typeof crearDb> };

function crearDb() {
  const cliente = postgres(url!, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });
  return drizzle(cliente, { schema });
}

export function obtenerDb() {
  if (!url) {
    throw new Error(
      "DATABASE_URL no configurada — ver docs/PENDIENTES-KUROSH.md y .env.example",
    );
  }
  globalPool.__estadiaDb ??= crearDb();
  return globalPool.__estadiaDb;
}

export type Db = ReturnType<typeof obtenerDb>;
export { schema };
