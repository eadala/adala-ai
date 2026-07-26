/**
 * Tenant ownership for GET /storage/objects/* — DB references only.
 * Exact equality on a single canonical object key. No pattern or substring matching.
 * Does NOT use object ACL metadata / canAccessObjectEntity.
 */
import { sql } from "drizzle-orm";
import { getPrivateObjectKeyPrefix } from "../core/storage/config";

export type OwnershipDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const withRows = result as { rows?: Record<string, unknown>[] } | null;
  return withRows?.rows ?? [];
}

const TRAVERSAL_RE = /(\.\.|%2e%2e|%252e|%c0%ae)/i;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

function defaultPrivatePrefix(): string {
  return getPrivateObjectKeyPrefix() || "private";
}

/** Reject encoded / literal traversal before and after a single URI decode. */
function rejectTraversal(raw: string): boolean {
  if (TRAVERSAL_RE.test(raw)) return true;
  if (raw.indexOf("\\") !== -1 || raw.indexOf("\0") !== -1) return true;
  return false;
}

function safeDecodeOnce(raw: string): string | null {
  if (rejectTraversal(raw)) return null;
  let decoded = raw;
  try {
    if (/%[0-9A-Fa-f]{2}/.test(raw)) {
      decoded = decodeURIComponent(raw);
    }
  } catch {
    return null;
  }
  if (decoded !== raw && /%[0-9A-Fa-f]{2}/.test(decoded)) {
    // Still encoded after one decode — ambiguous / double-encoded → fail closed
    return null;
  }
  if (rejectTraversal(decoded)) return null;
  if (decoded.indexOf("?") !== -1 || decoded.indexOf("#") !== -1) return null;
  return decoded;
}

function collapseSlashes(path: string): string {
  return path.replace(/\/{2,}/g, "/");
}

/**
 * Strip exactly one leading route wrapper. Returns null on duplicate / ambiguous wrappers.
 * Leaves a relative entity path such as `uploads/{uuid}` or already-prefixed `private/uploads/{uuid}`.
 */
function stripRouteWrappers(path: string): string | null {
  let p = path.replace(/^\/+/, "");

  // Strip /api/storage/ prefix only (not /objects/) so duplicate objects/ is detectable.
  if (p.startsWith("api/storage/")) {
    p = p.slice("api/storage/".length);
  }

  // Exactly one optional "objects/" wrapper — never objects/objects/
  if (p.startsWith("objects/objects/") || p === "objects/objects") return null;
  if (p.startsWith("objects/")) {
    p = p.slice("objects/".length);
  }
  if (p.startsWith("objects/")) return null;

  return p;
}

/**
 * Normalize any supported request / stored form into exactly one canonical storage key:
 *   `{privatePrefix}/uploads/{uuid}` (or `{privatePrefix}/{entity…}`)
 *
 * Supported inputs (examples):
 *   uploads/{uuid}
 *   /objects/uploads/{uuid}
 *   private/uploads/{uuid}
 *   /api/storage/objects/uploads/{uuid}
 *   https://host/api/storage/objects/uploads/{uuid}
 *
 * Rejects: traversal, malformed URLs, duplicate object/private prefixes, ambiguous paths.
 */
export function normalizeToCanonicalObjectKey(
  raw: string,
  privatePrefix: string = defaultPrivatePrefix(),
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (rejectTraversal(trimmed)) return null;

  let pathPart = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.search || url.hash) {
      // Query/hash on object refs is ambiguous for ownership — fail closed
      return null;
    }
    pathPart = url.pathname;
  }

  const decoded = safeDecodeOnce(pathPart);
  if (decoded === null) return null;

  let path = collapseSlashes(decoded).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!path) return null;

  const stripped = stripRouteWrappers(path);
  if (stripped === null) return null;
  path = stripped;

  const prefix = privatePrefix.replace(/^\/+|\/+$/g, "") || "private";

  // Duplicate private prefix → reject
  if (path.startsWith(`${prefix}/${prefix}/`) || path === `${prefix}/${prefix}`) {
    return null;
  }

  // If already canonical under private prefix, keep entity after prefix
  let entityId = path;
  if (entityId.startsWith(`${prefix}/`)) {
    entityId = entityId.slice(prefix.length + 1);
  }

  if (!entityId || entityId.startsWith(`${prefix}/`)) return null;
  if (entityId.startsWith("objects/")) return null;

  const segments = entityId.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  if (segments.some((s) => !SAFE_SEGMENT_RE.test(s))) return null;
  if (segments.some((s) => s === "." || s === "..")) return null;

  entityId = segments.join("/");
  return `${prefix}/${entityId}`;
}

/** Entity id for ObjectStorageService.getObjectEntityFile (`uploads/{uuid}`). */
export function entityIdFromCanonicalKey(
  canonicalKey: string,
  privatePrefix: string = defaultPrivatePrefix(),
): string | null {
  const prefix = privatePrefix.replace(/^\/+|\/+$/g, "") || "private";
  if (!canonicalKey.startsWith(`${prefix}/`)) return null;
  const entityId = canonicalKey.slice(prefix.length + 1);
  return entityId || null;
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

/** Collect string leaves from JSON for exact canonical comparison (no substring). */
export function collectJsonStringLeaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonStringLeaves(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectJsonStringLeaves(v, out);
    }
  }
  return out;
}

function refEqualsCanonical(
  ref: string | null | undefined,
  canonicalKey: string,
  privatePrefix: string,
): boolean {
  if (!ref || typeof ref !== "string") return false;
  const normalized = normalizeToCanonicalObjectKey(ref, privatePrefix);
  return normalized !== null && normalized === canonicalKey;
}

async function defaultDb(): Promise<OwnershipDb> {
  const { db } = await import("@workspace/db");
  return db as unknown as OwnershipDb;
}

/**
 * True only if canonicalKey is exactly referenced by this tenant via:
 * A) storage_files.storage_key or file_url, or
 * B) office branding / office_page.logo / website_config string leaves / team photo_url.
 * No pattern operators, includes, endsWith, or JSON text substring matching.
 */
export async function tenantOwnsCanonicalObjectKey(opts: {
  tenantId: string;
  canonicalKey: string;
  privatePrefix?: string;
  db?: OwnershipDb;
}): Promise<boolean> {
  const tenantId = opts.tenantId?.trim();
  if (!tenantId || tenantId === "platform") return false;

  const privatePrefix = opts.privatePrefix ?? defaultPrivatePrefix();
  const canonicalKey = opts.canonicalKey?.trim();
  if (!canonicalKey) return false;
  // Re-validate canonical form
  if (normalizeToCanonicalObjectKey(canonicalKey, privatePrefix) !== canonicalKey) {
    return false;
  }

  const client = opts.db ?? (await defaultDb());

  const files = await client.execute(sql`
    SELECT storage_key, file_url
    FROM storage_files
    WHERE office_id = ${tenantId}
      AND (storage_key IS NOT NULL OR file_url IS NOT NULL)
  `);
  for (const row of rowsOf(files)) {
    if (refEqualsCanonical(row.storage_key as string | null, canonicalKey, privatePrefix)) {
      return true;
    }
    if (refEqualsCanonical(row.file_url as string | null, canonicalKey, privatePrefix)) {
      return true;
    }
  }

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
      if (refEqualsCanonical(brandRow[col] as string | null, canonicalKey, privatePrefix)) {
        return true;
      }
    }
  }

  const page = await client.execute(sql`
    SELECT logo, website_config
    FROM office_page
    WHERE id::text = ${tenantId}
    LIMIT 1
  `);
  const pageRow = rowsOf(page)[0];
  if (pageRow) {
    if (refEqualsCanonical(pageRow.logo as string | null, canonicalKey, privatePrefix)) {
      return true;
    }
    const cfgRaw = pageRow.website_config;
    if (cfgRaw != null) {
      let parsed: unknown = cfgRaw;
      if (typeof cfgRaw === "string") {
        try {
          parsed = JSON.parse(cfgRaw);
        } catch {
          parsed = null;
        }
      }
      if (parsed != null) {
        for (const leaf of collectJsonStringLeaves(parsed)) {
          if (refEqualsCanonical(leaf, canonicalKey, privatePrefix)) {
            return true;
          }
        }
      }
    }
  }

  const team = await client.execute(sql`
    SELECT photo_url
    FROM office_team
    WHERE office_id::text = ${tenantId}
      AND photo_url IS NOT NULL
  `);
  for (const row of rowsOf(team)) {
    if (refEqualsCanonical(row.photo_url as string | null, canonicalKey, privatePrefix)) {
      return true;
    }
  }

  return false;
}
