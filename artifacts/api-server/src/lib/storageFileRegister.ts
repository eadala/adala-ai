import { sql } from "drizzle-orm";

/** Safe client-facing body when file+quota registration fails. */
export const STORAGE_REGISTER_FAILED = {
  code: "STORAGE_REGISTER_FAILED",
  message: "تعذر تسجيل الملف. يرجى المحاولة مرة أخرى.",
} as const;

export type RegisterStorageFileInput = {
  officeId: string;
  userId: string;
  originalName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  fileUrl?: string | null;
  storageKey?: string | null;
  category: string;
  caseId?: string | null;
  clientId?: string | null;
  fileHash: string | null;
};

type TxLike = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export type StorageRegisterDb = {
  transaction: <T>(fn: (tx: TxLike) => Promise<T>) => Promise<T>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const withRows = result as { rows?: Record<string, unknown>[] } | null;
  return withRows?.rows ?? [];
}

async function defaultDb(): Promise<StorageRegisterDb> {
  const { db } = await import("@workspace/db");
  return db as unknown as StorageRegisterDb;
}

/**
 * Insert storage_files + upsert office_storage_quota in one transaction.
 * On any failure the transaction rolls back (no orphan file row).
 * officeId must already be the canonical req.tenantId TEXT key (trial_* or permanent).
 */
export async function registerStorageFileWithQuota(
  input: RegisterStorageFileInput,
  deps?: { db?: StorageRegisterDb },
): Promise<{ record: Record<string, unknown> }> {
  const client = deps?.db ?? (await defaultDb());
  const size = Number(input.fileSize ?? 0);
  const fileName = input.storageKey ?? input.originalName;

  return client.transaction(async (tx) => {
    const inserted = await tx.execute(sql`
      INSERT INTO storage_files (
        office_id, case_id, client_id, uploaded_by, original_name, file_name,
        mime_type, file_size, file_hash, file_url, storage_key, category
      ) VALUES (
        ${input.officeId}, ${input.caseId ?? null}, ${input.clientId ?? null},
        ${input.userId}, ${input.originalName}, ${fileName},
        ${input.mimeType ?? null}, ${size}, ${input.fileHash},
        ${input.fileUrl ?? null}, ${input.storageKey ?? null}, ${input.category}
      )
      RETURNING *
    `);
    const rows = rowsOf(inserted);
    const record = rows[0];
    if (!record) {
      throw new Error("storage_files insert returned no row");
    }

    await tx.execute(sql`
      INSERT INTO office_storage_quota (office_id, used_bytes, files_count)
      VALUES (${input.officeId}, ${size}, 1)
      ON CONFLICT (office_id) DO UPDATE SET
        used_bytes = office_storage_quota.used_bytes + ${size},
        files_count = office_storage_quota.files_count + 1,
        updated_at = NOW()
    `);

    return { record };
  });
}

export function storageRegisterErrorResponse(): {
  status: 500;
  body: typeof STORAGE_REGISTER_FAILED;
} {
  return { status: 500, body: { ...STORAGE_REGISTER_FAILED } };
}
