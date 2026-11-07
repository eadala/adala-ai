import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { installPoolGucContainment } from "./gucContainment";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const rawPool = new Pool({ connectionString: process.env.DATABASE_URL });
/** Pool with GUC containment: bound-scope query routing + fail-closed on release. */
export const pool = installPoolGucContainment(rawPool);
export const db = drizzle(pool, { schema });

export {
  TENANT_DENY_SENTINEL,
  applyFailClosedGucs,
  applyOfficeGucs,
  applyBypassGucs,
  getBoundPoolClient,
  isDbScopeActive,
  withPinnedDbScope,
  withOfficeDbScope,
  withBypassDbScope,
  withFailClosedDbScope,
  installPoolGucContainment,
} from "./gucContainment";

export * from "./schema";
