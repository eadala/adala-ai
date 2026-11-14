/* eslint-disable @typescript-eslint/no-explicit-any -- DR center uses dynamic SQL row shapes */
import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import * as os from "os";
import { isObjectStorageConfigured } from "../../core/storage";

const router = Router();
const saGuard = requireSuperAdmin;

/* Migration 053 owns DDL; readiness only */
(async () => {
  try {
    const r = await db.execute(sql`
      SELECT
        to_regclass('public.dr_restore_points') IS NOT NULL AS dr_restore_points_present,
        to_regclass('public.dr_test_runs') IS NOT NULL AS dr_test_runs_present,
        to_regclass('public.dr_health_checks') IS NOT NULL AS dr_health_checks_present
    `) as any;
    const row = (Array.isArray(r) ? r[0] : (r?.rows ?? [])[0]) ?? {};
    if (!row.dr_restore_points_present || !row.dr_test_runs_present || !row.dr_health_checks_present) {
      console.error("[dr-center] Migration 053 schema not ready — dr_restore_points / dr_test_runs / dr_health_checks missing");
    }
  } catch {}
})();

async function safeQuery(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function safeOne(q: any): Promise<any> {
  return (await safeQuery(q))[0] ?? null;
}

/* ── Phase 7: Disaster Recovery Center ──────────────────────────────── */

async function checkComponentHealth(component: string): Promise<{ status: string; latency_ms: number; details: any }> {
  const start = Date.now();
  try {
    if (component === "database") {
      await db.execute(sql`SELECT 1`);
      return { status: "healthy", latency_ms: Date.now() - start, details: { message: "Database responding" } };
    }
    if (component === "object_storage") {
      const configured = isObjectStorageConfigured();
      return { status: configured ? "healthy" : "degraded", latency_ms: Date.now() - start, details: { configured, provider: "cloudflare_r2" } };
    }
    if (component === "memory") {
      const used = process.memoryUsage();
      const totalMb = os.totalmem() / 1024 / 1024;
      const freeMb  = os.freemem()  / 1024 / 1024;
      const usePct  = ((totalMb - freeMb) / totalMb) * 100;
      return { status: usePct > 90 ? "critical" : usePct > 75 ? "degraded" : "healthy", latency_ms: Date.now() - start, details: { usePct: Math.round(usePct), freeMb: Math.round(freeMb), heapUsed: Math.round(used.heapUsed / 1024 / 1024) } };
    }
    if (component === "disk") {
      const load = os.loadavg();
      return { status: load[0] > 4 ? "critical" : load[0] > 2 ? "degraded" : "healthy", latency_ms: Date.now() - start, details: { loadAvg: load } };
    }
    return { status: "unknown", latency_ms: Date.now() - start, details: {} };
  } catch (e: any) {
    return { status: "critical", latency_ms: Date.now() - start, details: { error: e.message } };
  }
}

router.get("/dr/health", saGuard, async (_req, res) => {
  try {
    const components = ["database", "object_storage", "memory", "disk"];
    const checks = await Promise.all(components.map(async (c) => {
      const result = await checkComponentHealth(c);
      await db.execute(sql`
        INSERT INTO dr_health_checks (component, status, latency_ms, details)
        VALUES (${c}, ${result.status}, ${result.latency_ms}, ${JSON.stringify(result.details)}::jsonb)
      `).catch(() => {});
      return { component: c, ...result };
    }));

    const overallStatus = checks.some(c => c.status === "critical") ? "critical"
      : checks.some(c => c.status === "degraded") ? "degraded" : "healthy";

    res.json({ overallStatus, components: checks, checkedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/dr/restore-points", saGuard, async (_req, res) => {
  try {
    const [dbRestorePoints, backupJobs] = await Promise.all([
      safeQuery(sql`SELECT * FROM dr_restore_points ORDER BY created_at DESC`),
      safeQuery(sql`SELECT * FROM backup_jobs ORDER BY created_at DESC LIMIT 20`).catch(() => []),
    ]);

    const points = [
      ...dbRestorePoints,
      ...backupJobs.map((b: any) => ({
        id: b.id,
        label: `نسخة احتياطية - ${new Date(b.created_at).toLocaleDateString("ar")}`,
        backup_type: b.backup_type ?? "full",
        size_bytes: b.file_size ?? 0,
        status: b.status ?? "available",
        test_status: "untested",
        created_at: b.created_at,
        source: "backup_jobs",
      })),
    ];

    res.json(points);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/dr/restore-points", saGuard, async (req, res) => {
  try {
    const { label, backup_type, size_bytes, location, rto_minutes, rpo_minutes } = req.body;
    const meta = auditMeta(req);
    const [row] = await safeQuery(sql`
      INSERT INTO dr_restore_points (label, backup_type, size_bytes, location, rto_minutes, rpo_minutes)
      VALUES (${label}, ${backup_type ?? 'full'}, ${size_bytes ?? 0}, ${location ?? null}, ${rto_minutes ?? 60}, ${rpo_minutes ?? 240})
      RETURNING id
    `);
    await auditLog({ ...meta, action: "DR_RESTORE_POINT_CREATED", resource: "dr_restore_points", resourceId: row?.id, details: label });
    res.json({ ok: true, id: row?.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/dr/restore-points/:id/test", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const meta = auditMeta(req);
    const start = Date.now();

    const [run] = await safeQuery(sql`
      INSERT INTO dr_test_runs (restore_point_id, initiated_by, status)
      VALUES (${id}, ${meta.userId ?? 'admin'}, 'running')
      RETURNING id
    `);

    const testResult = await simulateRestoreTest();
    const duration = Date.now() - start;
    const status =
      testResult.outcome === "PASS" ? "passed" :
      testResult.outcome === "BLOCKED" ? "blocked" :
      testResult.outcome === "NOT_RUN" ? "not_run" : "failed";

    await db.execute(sql`
      UPDATE dr_test_runs SET status=${status},
        result=${JSON.stringify(testResult)}::jsonb, duration_ms=${duration}, completed_at=NOW()
      WHERE id=${run?.id}
    `);
    await db.execute(sql`
      UPDATE dr_restore_points SET test_status=${status}, tested_at=NOW()
      WHERE id=${id}
    `);

    await auditLog({ ...meta, action: "DR_TEST_RUN", resource: "dr_restore_points", resourceId: id, details: `Test ${testResult.outcome}` });
    res.json({
      testRunId: run?.id,
      success: testResult.success,
      outcome: testResult.outcome,
      duration,
      result: testResult,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Evidence-driven DR workflow. Never defaults to PASS.
 * Outcomes: PASS | FAIL | BLOCKED | NOT_RUN
 */
async function simulateRestoreTest(): Promise<{
  success: boolean;
  outcome: "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";
  stages: string[];
  steps: any[];
  message: string;
}> {
  const stages: string[] = ["PRECHECK"];
  const steps: any[] = [];

  const artifactDir = process.env.ADALA_BACKUP_ARTIFACT_DIR;
  const adminUrl = process.env.ADALA_RESTORE_ADMIN_URL || process.env.DATABASE_URL;
  const restoreUrl = process.env.ADALA_RESTORE_DATABASE_URL;

  if (!artifactDir || !restoreUrl || !adminUrl) {
    stages.push("BLOCKED");
    steps.push({ step: "precheck_env", status: "blocked", detail: "ADALA_BACKUP_ARTIFACT_DIR / ADALA_RESTORE_DATABASE_URL required" });
    return {
      success: false,
      outcome: "BLOCKED",
      stages,
      steps,
      message: "DR restore verification BLOCKED — disposable restore env not configured",
    };
  }

  try {
    const { listLocalBackups, verifyBackupChecksum } = await import("../../reliability/backup/pgDumpBackup");
    const { verifyIsolatedRestore } = await import("../../reliability/dr/restoreVerify");
    const { incBackupMetric, recordRestoreVerified } = await import("../../reliability/observability/backupMetrics");

    const backups = listLocalBackups(artifactDir);
    if (!backups.length) {
      stages.push("FAILURE_INJECTION", "VALIDATION");
      steps.push({ step: "select_backup", status: "failed", detail: "missing_backup" });
      incBackupMetric("dr_fail");
      return { success: false, outcome: "FAIL", stages, steps, message: "No local backup artifact" };
    }

    const artifactPath = backups[backups.length - 1];
    stages.push("RECOVERY");
    if (!verifyBackupChecksum(artifactPath)) {
      steps.push({ step: "verify_checksum", status: "failed" });
      incBackupMetric("dr_fail");
      return { success: false, outcome: "FAIL", stages: [...stages, "VALIDATION"], steps, message: "Checksum/format verification failed" };
    }
    steps.push({ step: "verify_checksum", status: "passed" });

    process.env.ADALA_RESTORE_ALLOW = "1";
    const result = await verifyIsolatedRestore({
      artifactPath,
      restoreDatabaseUrl: restoreUrl,
      adminDatabaseUrl: adminUrl,
    });
    stages.push("VALIDATION", "REPORT");
    for (const s of result.stages) {
      steps.push({ step: s.stage, status: s.ok ? "passed" : "failed", detail: s.detail });
    }

    if (result.outcome === "PASS") {
      recordRestoreVerified(result.restoreDurationMs ?? 0);
      incBackupMetric("dr_pass");
      return { success: true, outcome: "PASS", stages, steps, message: "Isolated restore verified" };
    }
    incBackupMetric(result.outcome === "BLOCKED" ? "dr_blocked" : "dr_fail");
    return {
      success: false,
      outcome: result.outcome,
      stages,
      steps,
      message: result.error || "Restore verification failed",
    };
  } catch (e: any) {
    stages.push("VALIDATION", "REPORT");
    steps.push({ step: "exception", status: "failed", detail: e?.message });
    return { success: false, outcome: "FAIL", stages, steps, message: e?.message || "DR test failed" };
  }
}

router.get("/dr/dashboard", saGuard, async (_req, res) => {
  try {
    const [latestRestore, testRuns, healthHistory, backupStats] = await Promise.all([
      safeOne(sql`SELECT * FROM dr_restore_points ORDER BY created_at DESC LIMIT 1`),
      safeQuery(sql`SELECT * FROM dr_test_runs ORDER BY created_at DESC LIMIT 10`),
      safeQuery(sql`SELECT * FROM dr_health_checks ORDER BY checked_at DESC LIMIT 50`),
      safeOne(sql`SELECT COUNT(*) as total, SUM(size_bytes) as total_size FROM dr_restore_points WHERE status='available'`),
    ]);

    const passed   = testRuns.filter((r: any) => r.status === "passed").length;
    const successRate = testRuns.length > 0 ? Math.round((passed / testRuns.length) * 100) : 0;

    const [dbHealth, storageHealth, memHealth] = await Promise.all([
      checkComponentHealth("database"),
      checkComponentHealth("object_storage"),
      checkComponentHealth("memory"),
    ]);

    res.json({
      latestRestore,
      testRuns,
      successRate,
      totalRestorePoints: Number(backupStats?.total ?? 0),
      totalBackupSize: Number(backupStats?.total_size ?? 0),
      health: { database: dbHealth, storage: storageHealth, memory: memHealth },
      healthHistory,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
