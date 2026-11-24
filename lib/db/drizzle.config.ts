import { defineConfig } from "drizzle-kit";
import path from "path";

/**
 * Schema authority
 * ────────────────
 * Production / shared DDL authority:
 *   artifacts/api-server/migrations/*.sql  (apply via psql — see migrations/README.md)
 *
 * This package (`lib/db/src/schema`) is the ORM type source for Drizzle queries.
 * `drizzle-kit push` is for local/dev only — never apply push against Production.
 * When the TypeScript schema changes, add a numbered SQL migration; do not rely
 * on Runtime CREATE/ALTER in the API process.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },
});
