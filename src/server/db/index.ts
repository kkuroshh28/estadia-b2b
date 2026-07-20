import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexión por entorno (dev/staging/prod tienen DATABASE_URL distintas y
 * bases SEPARADAS — ver docs/ARQUITECTURA.md §3).
 * `prepare: false` por compatibilidad con poolers (Supabase pgbouncer).
 */
const url = process.env.DATABASE_URL;

// Pool ÚNICO por proceso, cacheado en globalThis: sobrevive el hot-reload de
// dev y evita crear un pool por petición (agotaría las conexiones de Postgres).
const globalPool = globalThis as unknown as { __estadiaDb?: ReturnType<typeof crearDb> };

function crearDb() {
  const cliente = postgres(url!, { prepare: false, max: 10 });
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
