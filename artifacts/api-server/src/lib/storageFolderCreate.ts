import { sql } from "drizzle-orm";

export type CreateStorageFolderInput = {
  officeId: string;
  userId: string;
  name: string;
  parentId?: string | null;
};

type DbLike = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const withRows = result as { rows?: Record<string, unknown>[] } | null;
  return withRows?.rows ?? [];
}

async function defaultDb(): Promise<DbLike> {
  const { db } = await import("@workspace/db");
  return db as unknown as DbLike;
}

/**
 * Insert a storage_folders row and return the created row.
 *
 * Never swallows a failed INSERT (unlike the route's local `dbRows` helper,
 * which returns [] on any DB error). A swallowed error here previously made
 * the route call `res.json(rows[0])` with `rows === []`, sending the client
 * an HTTP 200 with an empty body — which crashes Safari's `Response.json()`
 * with "The string did not match the expected pattern." and, in production,
 * silently discarded the create with no logged cause (root cause: missing
 * `storage_folders` table, see migration 009).
 */
export async function createStorageFolder(
  input: CreateStorageFolderInput,
  deps?: { db?: DbLike },
): Promise<{ folder: Record<string, unknown> }> {
  const client = deps?.db ?? (await defaultDb());
  const inserted = await client.execute(sql`
    INSERT INTO storage_folders (office_id, parent_id, name, created_by)
    VALUES (${input.officeId}, ${input.parentId ?? null}, ${input.name}, ${input.userId})
    RETURNING *
  `);
  const rows = rowsOf(inserted);
  const folder = rows[0];
  if (!folder) {
    throw new Error("storage_folders insert returned no row");
  }
  return { folder };
}
