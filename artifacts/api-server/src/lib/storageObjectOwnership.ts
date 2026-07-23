/**
 * Tenant ownership for GET /storage/objects/* — DB references only.
 * Does NOT use object ACL metadata / canAccessObjectEntity.
 */
import { sql } from "drizzle-orm";

export type OwnershipDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const withRows = result as { rows?: Record<string, unknown>[] } | null;
  return withRows?.rows ?? [];
}

/** Entity id as used by getObjectEntityFile: path after /objects/. */
export function entityIdFromObjectsWildcard(wildcardPath: string): string | null {
  if (typeof wildcardPath !== "string") return null;
  const trimmed = wildcardPath.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return null;
  return trimmed;
}

/** Canonical /objects/{entityId} path stored by upload helpers. */
export function objectEntityPath(entityId: string): string {
  return `/objects/${entityId}`;
}

/**
 * Forms commonly stored in storage_files / branding / office_page fields.
 * Matching is exact against this set, or suffix/contains on entityId for full URLs.
 */
export function buildOwnershipMatchCandidates(
  entityId: string,
  objectKey: string,
): string[] {
  const objectPath = objectEntityPath(entityId);
  const set = new Set<string>([
    entityId,
    objectPath,
    objectKey,
    `/api/storage/objects/${entityId}`,
    `/api/storage${objectPath}`,
    `api/storage/objects/${entityId}`,
    `api/storage${objectPath}`,
    // Some clients concatenate `/api/storage/objects` + `/objects/...`
    `/api/storage/objects${objectPath}`,
  ]);
  return [...set].filter(Boolean);
}

export function brandingRefMatchesObject(
  ref: string | null | undefined,
  entityId: string,
  candidates: string[],
): boolean {
  if (!ref || typeof ref !== "string") return false;
  const trimmed = ref.trim();
  if (!trimmed) return false;
  if (candidates.includes(trimmed)) return true;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const path = new URL(trimmed).pathname;
      if (candidates.includes(path)) return true;
      if (path.endsWith(`/${entityId}`) || path.endsWith(entityId)) return true;
      if (
        path.includes(`/objects/${entityId}`) ||
        path.includes(`/storage/objects/${entityId}`)
      ) {
        return true;
      }
    } catch {
      /* fall through */
    }
  }

  if (
    trimmed.endsWith(entityId) ||
    trimmed.includes(`/objects/${entityId}`) ||
    trimmed.includes(`/storage/objects/${entityId}`)
  ) {
    return true;
  }
  return false;
}

const BRANDING_URL_COLUMNS = [
  "logo_url",
  "stamp_url",
  "signature_url",
  "favicon_url",
  "login_background_url",
  "watermark_url",
  "letterhead_url",
] as const;

async function defaultDb(): Promise<OwnershipDb> {
  const { db } = await import("@workspace/db");
  return db as unknown as OwnershipDb;
}

/**
 * True only if:
 * A) storage_files has matching storage_key/file_url for this tenant, or
 * B) this tenant's office branding / office_page / team photo references the object.
 * No other fallback (ACL metadata, SA bypass, userId).
 */
export async function tenantOwnsStorageObject(opts: {
  tenantId: string;
  wildcardPath: string;
  objectKey: string;
  db?: OwnershipDb;
}): Promise<boolean> {
  const tenantId = opts.tenantId?.trim();
  if (!tenantId || tenantId === "platform") return false;

  const entityId = entityIdFromObjectsWildcard(opts.wildcardPath);
  if (!entityId) return false;

  const objectKey = opts.objectKey?.trim();
  if (!objectKey) return false;

  const candidates = buildOwnershipMatchCandidates(entityId, objectKey);
  const objectPath = objectEntityPath(entityId);
  const client = opts.db ?? (await defaultDb());

  const files = await client.execute(sql`
    SELECT 1 AS ok
    FROM storage_files
    WHERE office_id = ${tenantId}
      AND (
        storage_key = ${objectPath}
        OR storage_key = ${entityId}
        OR storage_key = ${objectKey}
        OR file_url = ${`/api/storage/objects/${entityId}`}
        OR file_url = ${`/api/storage${objectPath}`}
        OR file_url = ${`/api/storage/objects${objectPath}`}
        OR storage_key LIKE ${"%" + entityId}
        OR file_url LIKE ${"%" + entityId}
      )
    LIMIT 1
  `);
  if (rowsOf(files).length > 0) return true;

  const branding = await client.execute(sql`
    SELECT logo_url, stamp_url, signature_url, favicon_url,
           login_background_url, watermark_url, letterhead_url
    FROM office_branding
    WHERE tenant_id = ${tenantId}
    LIMIT 1
  `);
  const brandRow = rowsOf(branding)[0];
  if (brandRow) {
    for (const col of BRANDING_URL_COLUMNS) {
      if (brandingRefMatchesObject(brandRow[col] as string | null, entityId, candidates)) {
        return true;
      }
    }
  }

  const page = await client.execute(sql`
    SELECT logo, website_config::text AS website_config_text
    FROM office_page
    WHERE id::text = ${tenantId}
    LIMIT 1
  `);
  const pageRow = rowsOf(page)[0];
  if (pageRow) {
    if (brandingRefMatchesObject(pageRow.logo as string | null, entityId, candidates)) {
      return true;
    }
    const cfg = pageRow.website_config_text as string | null;
    if (cfg && (cfg.includes(entityId) || candidates.some((c) => cfg.includes(c)))) {
      return true;
    }
  }

  const team = await client.execute(sql`
    SELECT photo_url
    FROM office_team
    WHERE office_id::text = ${tenantId}
      AND photo_url IS NOT NULL
      AND (
        photo_url = ${objectPath}
        OR photo_url = ${entityId}
        OR photo_url LIKE ${"%" + entityId}
      )
    LIMIT 1
  `);
  if (rowsOf(team).length > 0) return true;

  return false;
}
