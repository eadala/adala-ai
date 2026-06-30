import { Router } from "express";
import { requireSuperAdmin, checkIsSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import { createClerkClient } from "@clerk/express";

const router = Router();
const saGuard = requireSuperAdmin;

let _clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS high_risk_op_log (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operation     TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        office_id     TEXT,
        ip_address    TEXT,
        user_agent    TEXT,
        confirmed_mfa BOOLEAN DEFAULT false,
        confirmed_pwd BOOLEAN DEFAULT false,
        result        TEXT DEFAULT 'pending',
        metadata      JSONB DEFAULT '{}',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS recovery_codes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT NOT NULL,
        code_hash   TEXT NOT NULL,
        used        BOOLEAN DEFAULT false,
        used_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_high_risk_op_user ON high_risk_op_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes(user_id);
    `);
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

/* ── Phase 4: MFA Enforcement ─────────────────────────────────────────── */

router.get("/mfa/status", saGuard, async (req, res) => {
  try {
    const users = await getClerk().users.getUserList({ limit: 100 });
    const mfaData = (users?.data ?? []).map((u: any) => ({
      userId:    u.id,
      email:     u.emailAddresses?.[0]?.emailAddress,
      firstName: u.firstName,
      lastName:  u.lastName,
      hasMfa:    (u.totpEnabled || u.backupCodeEnabled || (u.twoFactorEnabled ?? false)),
      isSA:      u.publicMetadata?.role === "super_admin",
      lastSignIn: u.lastSignInAt,
    }));

    const saWithoutMfa = mfaData.filter((u: any) => u.isSA && !u.hasMfa);

    for (const u of mfaData) {
      await db.execute(sql`
        INSERT INTO mfa_status_cache (user_id, has_mfa, checked_at, mfa_methods)
        VALUES (${u.userId}, ${u.hasMfa}, NOW(), '[]'::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET has_mfa=${u.hasMfa}, checked_at=NOW()
      `).catch(() => {});
    }

    res.json({ users: mfaData, saWithoutMfa, totalUsers: mfaData.length, mfaEnabled: mfaData.filter((u: any) => u.hasMfa).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/mfa/enforce-alert", saGuard, async (req, res) => {
  try {
    const { userId } = req.body;
    const meta = auditMeta(req);
    await db.execute(sql`
      INSERT INTO security_alerts (alert_type, severity, title, description, user_id, metadata)
      VALUES ('MFA_NOT_ENABLED', 'high', 'مستخدم Super Admin بدون MFA', 
              ${'Super Admin ' + userId + ' لا يملك MFA مفعّلاً'},
              ${userId}, '{"type":"mfa_enforcement"}'::jsonb)
    `);
    await auditLog({ ...meta, action: "MFA_ENFORCEMENT_ALERT", resource: "mfa", resourceId: userId, details: `SA user ${userId} lacks MFA` });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/mfa/recovery-codes/:userId", saGuard, async (req, res) => {
  try {
    const { userId } = req.params as any;
    const codes = await safeQuery(sql`
      SELECT id, used, used_at, created_at FROM recovery_codes WHERE user_id=${userId} ORDER BY created_at DESC
    `);
    res.json({ userId, codes, total: codes.length, used: codes.filter((c: any) => c.used).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Phase 5: High Risk Operations ────────────────────────────────────── */

const HIGH_RISK_OPS: Record<string, { label: string; requireMfa: boolean; requirePwd: boolean; severity: string }> = {
  DELETE_OFFICE:        { label: "حذف مكتب",              requireMfa: true, requirePwd: true,  severity: "critical" },
  DELETE_DOCUMENTS:     { label: "حذف مستندات",           requireMfa: true, requirePwd: false, severity: "high"     },
  RESTORE_BACKUP:       { label: "استعادة النسخة الاحتياطية", requireMfa: true, requirePwd: true, severity: "critical" },
  ROTATE_SECRETS:       { label: "تدوير المفاتيح السرية",  requireMfa: true, requirePwd: true,  severity: "critical" },
  CHANGE_BILLING:       { label: "تغيير الفوترة",          requireMfa: true, requirePwd: false, severity: "high"     },
  GRANT_SUPER_ADMIN:    { label: "منح صلاحية Super Admin", requireMfa: true, requirePwd: true,  severity: "critical" },
  REMOVE_SUPER_ADMIN:   { label: "سحب صلاحية Super Admin", requireMfa: true, requirePwd: true,  severity: "critical" },
  PROD_CONFIG_CHANGE:   { label: "تغيير إعدادات الإنتاج", requireMfa: true, requirePwd: true,  severity: "critical" },
  EXPORT_ALL_DATA:      { label: "تصدير كل البيانات",      requireMfa: true, requirePwd: true,  severity: "high"     },
  PURGE_DATA:           { label: "تطهير البيانات",         requireMfa: true, requirePwd: true,  severity: "critical" },
};

router.get("/high-risk-ops/catalog", saGuard, async (_req, res) => {
  res.json(Object.entries(HIGH_RISK_OPS).map(([key, val]) => ({ operation: key, ...val })));
});

router.get("/high-risk-ops/logs", saGuard, async (req, res) => {
  try {
    const { limit = 50 } = req.query as any;
    const rows = await safeQuery(sql`
      SELECT * FROM high_risk_op_log ORDER BY created_at DESC LIMIT ${Number(limit)}
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/high-risk-ops/initiate", saGuard, async (req, res) => {
  try {
    const { operation, metadata } = req.body;
    const meta = auditMeta(req);
    const opConfig = HIGH_RISK_OPS[operation];
    if (!opConfig) return res.status(400).json({ error: "Unknown operation" });

    const [row] = await safeQuery(sql`
      INSERT INTO high_risk_op_log (operation, user_id, ip_address, user_agent, metadata)
      VALUES (${operation}, ${meta.userId ?? 'unknown'}, ${meta.ipAddress ?? null}, ${meta.userAgent ?? null}, ${JSON.stringify(metadata ?? {})}::jsonb)
      RETURNING id
    `);

    await auditLog({
      ...meta,
      action:     `HIGH_RISK_INITIATED_${operation}`,
      resource:   "high_risk_ops",
      resourceId: row?.id,
      details:    opConfig.label,
    });

    res.json({
      operationId: row?.id,
      operation,
      config: opConfig,
      requireMfa: opConfig.requireMfa,
      requirePwd: opConfig.requirePwd,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/high-risk-ops/:id/confirm", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const { mfaConfirmed, pwdConfirmed } = req.body;
    const meta = auditMeta(req);

    const op = await safeOne(sql`SELECT * FROM high_risk_op_log WHERE id=${id}`);
    if (!op) return res.status(404).json({ error: "Operation not found" });
    const opConfig = HIGH_RISK_OPS[op.operation];

    if (opConfig?.requireMfa && !mfaConfirmed) return res.status(403).json({ error: "MFA confirmation required" });
    if (opConfig?.requirePwd && !pwdConfirmed) return res.status(403).json({ error: "Password confirmation required" });

    await db.execute(sql`
      UPDATE high_risk_op_log SET confirmed_mfa=${!!mfaConfirmed}, confirmed_pwd=${!!pwdConfirmed}, result='approved'
      WHERE id=${id}
    `);
    await auditLog({ ...meta, action: `HIGH_RISK_CONFIRMED_${op.operation}`, resource: "high_risk_ops", resourceId: id });
    res.json({ ok: true, approved: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/high-risk-ops/:id/abort", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const meta = auditMeta(req);
    await db.execute(sql`UPDATE high_risk_op_log SET result='aborted' WHERE id=${id}`);
    await auditLog({ ...meta, action: "HIGH_RISK_ABORTED", resource: "high_risk_ops", resourceId: id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
