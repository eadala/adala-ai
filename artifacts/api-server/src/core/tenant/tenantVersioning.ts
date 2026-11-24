/**
 * Tenant Versioning System
 * ─────────────────────────
 * كل مستخدم له "binding" واحد للمكتب مع رقم version.
 * إذا تغيّر المكتب → يُحفظ السجل القديم في tenant_binding_history تلقائياً.
 * recoverIdentity() تُعيد الهوية من آخر نقطة صالحة.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/* ── Ensure tables ─────────────────────────────────────────────────── */

let tablesReady = false;
export async function ensureVersioningTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const r = await db.execute(sql`
      SELECT
        to_regclass('public.tenant_bindings') IS NOT NULL AS bindings_present,
        to_regclass('public.tenant_binding_history') IS NOT NULL AS history_present,
        to_regclass('public.tenant_audit_archive') IS NOT NULL AS archive_present
    `) as { rows?: { bindings_present?: boolean; history_present?: boolean; archive_present?: boolean }[] };
    const row = (Array.isArray(r) ? r[0] : (r?.rows ?? [])[0]) ?? {};
    if (!row.bindings_present || !row.history_present || !row.archive_present) {
      console.error("[tenantVersioning] Migration 055 schema not ready — tenant_bindings / history / archive missing");
      return;
    }
    tablesReady = true;
  } catch { /* non-blocking */ }
}

/* ── helpers ─────────────────────────────────────────────────────────── */

async function dbOne(q: any): Promise<any> {
  try {
    const r = await db.execute(q) as any;
    return (Array.isArray(r) ? r : (r?.rows ?? []))[0] ?? null;
  } catch { return null; }
}

/* ── bindTenant — call after every successful tenant resolution ─────── */

/**
 * Records / updates the canonical tenant binding for this user.
 * If the tenant has CHANGED since last binding, the old one is archived
 * in tenant_binding_history and the version is incremented.
 * This is fire-and-forget — never awaited on the hot path.
 */
export async function bindTenant(
  userId: string,
  tenantId: string,
  source: string,
): Promise<void> {
  try {
    await ensureVersioningTables();
    const existing = await dbOne(sql`
      SELECT tenant_id, version, source, updated_at
      FROM tenant_bindings WHERE user_id = ${userId}
    `);

    if (!existing) {
      /* First time — insert fresh binding */
      await db.execute(sql`
        INSERT INTO tenant_bindings (user_id, tenant_id, version, source, updated_at)
        VALUES (${userId}, ${tenantId}, 1, ${source}, NOW())
        ON CONFLICT (user_id) DO NOTHING
      `);
      return;
    }

    if (existing.tenant_id === tenantId) return; /* No change — fast exit */

    /* Tenant changed — archive old binding first */
    await db.execute(sql`
      INSERT INTO tenant_binding_history
        (user_id, tenant_id, version, source, started_at, ended_at)
      VALUES (
        ${userId}, ${existing.tenant_id},
        ${existing.version}, ${existing.source},
        ${existing.updated_at}, NOW()
      )
    `);

    /* Bump version */
    await db.execute(sql`
      UPDATE tenant_bindings
      SET tenant_id  = ${tenantId},
          version    = ${(existing.version as number) + 1},
          source     = ${source},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `);
  } catch { /* non-blocking — never throw */ }
}

/* ── recoverIdentity — restore from last known-good binding ─────────── */

export async function recoverIdentity(userId: string): Promise<{
  tenantId: string;
  version: number;
  restoredFrom: number;
} | null> {
  await ensureVersioningTables();

  const history = await (async () => {
    try {
      const r = await db.execute(sql`
        SELECT tenant_id, version, source, ended_at
        FROM tenant_binding_history
        WHERE user_id = ${userId}
        ORDER BY version DESC
        LIMIT 5
      `) as any;
      return Array.isArray(r) ? r : (r?.rows ?? []);
    } catch { return []; }
  })();

  if (!history.length) return null;

  const best = history[0];
  /* Restore the binding */
  await db.execute(sql`
    INSERT INTO tenant_bindings (user_id, tenant_id, version, source, updated_at)
    VALUES (${userId}, ${best.tenant_id}, ${best.version}, 'recovered', NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      tenant_id  = EXCLUDED.tenant_id,
      version    = (tenant_bindings.version + 1),
      source     = 'recovered',
      updated_at = NOW()
  `);

  /* Re-link office_members if needed */
  await db.execute(sql`
    INSERT INTO office_members (office_id, user_id, role, status)
    VALUES (${best.tenant_id}, ${userId}, 'owner', 'active')
    ON CONFLICT DO NOTHING
  `).catch(() => {});

  const current = await dbOne(sql`
    SELECT tenant_id, version FROM tenant_bindings WHERE user_id = ${userId}
  `);
  return {
    tenantId: current?.tenant_id ?? best.tenant_id,
    version:  current?.version  ?? best.version,
    restoredFrom: best.version,
  };
}

/* ── getBindingHistory — for UI display ────────────────────────────── */

export async function getBindingHistory(userId: string): Promise<any[]> {
  await ensureVersioningTables();
  try {
    const r = await db.execute(sql`
      SELECT * FROM tenant_binding_history
      WHERE user_id = ${userId}
      ORDER BY version DESC LIMIT 10
    `) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/* ── compressAuditLogs — archive logs older than N days ─────────────── */

export async function compressAuditLogs(daysOld = 7): Promise<number> {
  try {
    await ensureVersioningTables();
    const r = await db.execute(sql`
      SELECT to_regclass('public.tenant_audit_archive') IS NOT NULL AS present
    `) as { rows?: { present?: boolean }[] };
    const row = (Array.isArray(r) ? r[0] : (r?.rows ?? [])[0]) ?? {};
    if (!row.present) return 0;

    /* Aggregate + archive */
    await db.execute(sql`
      INSERT INTO tenant_audit_archive (tenant_id, period, total, failures, sources)
      SELECT
        COALESCE(tenant_id, 'unresolved') AS tenant_id,
        DATE(created_at)                  AS period,
        COUNT(*)::int                     AS total,
        COUNT(*) FILTER (WHERE resolved = false)::int AS failures,
        jsonb_agg(DISTINCT source)        AS sources
      FROM tenant_audit_logs
      WHERE created_at < NOW() - (${daysOld} || ' days')::INTERVAL
      GROUP BY COALESCE(tenant_id, 'unresolved'), DATE(created_at)
      ON CONFLICT (tenant_id, period)
      DO UPDATE SET
        total    = tenant_audit_archive.total    + EXCLUDED.total,
        failures = tenant_audit_archive.failures + EXCLUDED.failures
    `);

    /* Delete compressed rows */
    const del = await db.execute(sql`
      DELETE FROM tenant_audit_logs
      WHERE created_at < NOW() - (${daysOld} || ' days')::INTERVAL
    `) as any;
    return del?.rowCount ?? 0;
  } catch { return 0; }
}
