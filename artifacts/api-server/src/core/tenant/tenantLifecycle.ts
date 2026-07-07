/**
 * Tenant lifecycle — persistent freeze / suspend (PR-TNT-002).
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type TenantLifecycleStatus = "active" | "frozen" | "suspended" | "deleted";

export class TenantLifecycleError extends Error {
  readonly code = "TNT_LIFECYCLE" as const;
  readonly officeId: string;
  readonly status: TenantLifecycleStatus;

  constructor(officeId: string, status: TenantLifecycleStatus) {
    super(
      status === "frozen"
        ? "المكتب مجمّد مؤقتاً — تواصل مع الدعم"
        : "حساب المكتب موقوف — تواصل مع الإدارة",
    );
    this.name = "TenantLifecycleError";
    this.officeId = officeId;
    this.status = status;
  }
}

let schemaReady = false;

/** In-memory cache of lifecycle-blocked offices — synced from DB at boot and on mutations */
const lifecycleBlockedCache = new Set<string>();

export function isOfficeLifecycleBlocked(officeId: string): boolean {
  return lifecycleBlockedCache.has(officeId);
}

export function getLifecycleBlockedOffices(): string[] {
  return Array.from(lifecycleBlockedCache);
}

function syncCacheEntry(officeId: string, status: TenantLifecycleStatus): void {
  if (status === "frozen" || status === "suspended") lifecycleBlockedCache.add(officeId);
  else lifecycleBlockedCache.delete(officeId);
}

/** Boot-time sync — restores freeze state after process restart */
export async function bootLifecycleCache(): Promise<void> {
  await ensureTenantLifecycleSchema();
  lifecycleBlockedCache.clear();
  const row = await db.execute(sql`
    SELECT id FROM office_registry
    WHERE lifecycle_status IN ('frozen', 'suspended')
  `).catch(() => ({ rows: [] }));
  const rows = (row as { rows?: { id?: string }[] }).rows ?? [];
  for (const r of rows) {
    if (r.id) lifecycleBlockedCache.add(String(r.id));
  }
}

export async function ensureTenantLifecycleSchema(): Promise<void> {
  if (schemaReady) return;
  await db.execute(sql`
    ALTER TABLE office_registry
      ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
      ADD COLUMN IF NOT EXISTS frozen_by TEXT
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_office_registry_lifecycle
      ON office_registry(lifecycle_status)
  `).catch(() => {});
  schemaReady = true;
}

export async function getTenantLifecycleStatus(officeId: string): Promise<TenantLifecycleStatus> {
  await ensureTenantLifecycleSchema();
  const row = await db.execute(sql`
    SELECT lifecycle_status FROM office_registry WHERE id = ${officeId} LIMIT 1
  `).catch(() => ({ rows: [] }));
  const rows = (row as { rows?: { lifecycle_status?: string }[] }).rows ?? [];
  const status = rows[0]?.lifecycle_status ?? "active";
  if (status === "frozen" || status === "suspended" || status === "deleted") return status;
  return "active";
}

export async function assertTenantActive(officeId: string): Promise<void> {
  const status = await getTenantLifecycleStatus(officeId);
  if (status !== "active") throw new TenantLifecycleError(officeId, status);
}

export async function setTenantLifecycle(
  officeId: string,
  status: TenantLifecycleStatus,
  meta?: { reason?: string; by?: string },
): Promise<void> {
  await ensureTenantLifecycleSchema();
  await db.execute(sql`
    UPDATE office_registry SET
      lifecycle_status = ${status},
      frozen_at = ${status === "frozen" ? new Date().toISOString() : null},
      frozen_reason = ${meta?.reason ?? null},
      frozen_by = ${meta?.by ?? null},
      status = ${status === "deleted" ? "inactive" : status === "active" ? "active" : "suspended"}
    WHERE id = ${officeId}
  `).catch(() => {});
  syncCacheEntry(officeId, status);
}

export function tenantLifecycleResponse(err: TenantLifecycleError) {
  return {
    error: err.message,
    code: err.code,
    officeId: err.officeId,
    lifecycleStatus: err.status,
  };
}
