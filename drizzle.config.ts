import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Por entorno: dev/.env.local · staging/prod: variables de Vercel/CI.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/estadia_dev",
  },
  strict: true,
  verbose: true,
});
