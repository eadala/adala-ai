/**
 * HR Enterprise System — نظام الموارد البشرية المؤسسي
 * ─────────────────────────────────────────────────────────────────────────
 * طبقات النظام:
 *   1. Authorization Engine   — authorize(userId, officeId, permission)
 *   2. RBAC Fine-Grained      — roles + permissions + role_permissions (per-office)
 *   3. HR Workflows           — طلبات إجازة / تعيين / رفع صلاحية (Approval Flow)
 *   4. HR Audit Logs          — كل تغيير HR يُسجَّل
 *   5. SOC Integration        — أحداث HR الحرجة تصل للمنظومة الأمنية
 *   6. Office Membership      — ربط المستخدمين بالمكاتب مع دور محدد
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuthWithTenant, requirePermission } from "../../middlewares/requireAuth";
import { eventBus } from "../../core/eventBus";

const router = Router();

function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }
function num(v: any)         { return parseFloat(String(v ?? "0")) || 0; }

/* ══════════════════════════════════════════════════════════
   ENSURE TABLES
══════════════════════════════════════════════════════════ */
export async function ensureHREnterpriseTables(): Promise<void> {
  /* 1. RBAC — أدوار الموظفين داخل المكتب */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hr_roles (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id    TEXT NOT NULL,
      name         TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description  TEXT,
      scope        TEXT NOT NULL DEFAULT 'tenant',  -- tenant | system
      hierarchy    INT  NOT NULL DEFAULT 5,          -- 1=Partner 5=Intern
      is_system    BOOLEAN DEFAULT FALSE,
      permissions  JSONB NOT NULL DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(office_id, name)
    )
  `).catch(() => {});

  /* 2. Office Membership — انتماء الموظف للمكتب بدور */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hr_memberships (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      employee_id UUID,
      role_name   TEXT NOT NULL DEFAULT 'lawyer',
      status      TEXT NOT NULL DEFAULT 'active',  -- active | suspended | terminated
      joined_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(office_id, user_id)
    )
  `).catch(() => {});

  /* 3. HR Workflows — طلبات الموافقة */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hr_workflows (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id       TEXT NOT NULL,
      type            TEXT NOT NULL,   -- leave_request | role_change | new_hire | permission_upgrade | termination
      requester_id    TEXT NOT NULL,
      requester_name  TEXT,
      approver_id     TEXT,
      approver_name   TEXT,
      subject_user_id TEXT,
      subject_name    TEXT,
      payload         JSONB NOT NULL DEFAULT '{}',
      status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | cancelled
      priority        TEXT NOT NULL DEFAULT 'normal',  -- low | normal | high | critical
      notes           TEXT,
      reviewed_at     TIMESTAMPTZ,
      expires_at      TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_hrwf_office ON hr_workflows(office_id, status)`).catch(() => {});

  /* 4. HR Audit Logs — سجل التدقيق */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hr_audit_logs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id    TEXT NOT NULL,
      user_id      TEXT,
      user_name    TEXT,
      action       TEXT NOT NULL,   -- role_changed | suspended | hired | promoted | terminated | permission_granted
      target_type  TEXT,            -- employee | member | role | workflow
      target_id    TEXT,
      target_name  TEXT,
      old_value    JSONB,
      new_value    JSONB,
      severity     TEXT DEFAULT 'low',  -- low | medium | high | critical
      ip_address   TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_hral_office ON hr_audit_logs(office_id, created_at DESC)`).catch(() => {});

  /* Seed default roles per office is done on first-request basis (lazy) */
}

/* ── HR Audit Logger ─────────────────────────────────────────────────────── */
async function hrAuditLog(params: {
  officeId: string; userId?: string; userName?: string; action: string;
  targetType?: string; targetId?: string; targetName?: string;
  oldValue?: any; newValue?: any; severity?: string; ipAddress?: string;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO hr_audit_logs
      (office_id, user_id, user_name, action, target_type, target_id, target_name,
       old_value, new_value, severity, ip_address)
    VALUES (${params.officeId}, ${params.userId ?? null}, ${params.userName ?? null},
            ${params.action}, ${params.targetType ?? null}, ${params.targetId ?? null},
            ${params.targetName ?? null},
            ${params.oldValue ? JSON.stringify(params.oldValue) : null}::jsonb,
            ${params.newValue ? JSON.stringify(params.newValue) : null}::jsonb,
            ${params.severity ?? "low"}, ${params.ipAddress ?? null})
  `).catch(() => {});
}

/* ── SOC Integration ─────────────────────────────────────────────────────── */
function emitHRSecurityEvent(type: string, officeId: string, data: any) {
  eventBus.emit({ type: "SECURITY_EVENT" as any, data: { hrEventType: type, officeId, ...data } }).catch(() => {});
}

/* ── Authorization Engine ────────────────────────────────────────────────── */
export async function authorize(userId: string, officeId: string, permission: string): Promise<boolean> {
  if (!userId || !officeId) return false;
  const r = one(await db.execute(sql`
    SELECT 1 AS granted
    FROM hr_memberships m
    JOIN hr_roles r ON r.office_id = m.office_id AND r.name = m.role_name
    WHERE m.user_id = ${userId}
      AND m.office_id = ${officeId}
      AND m.status = 'active'
      AND (r.permissions @> ${JSON.stringify(["*"])}::jsonb
           OR r.permissions @> ${JSON.stringify([permission])}::jsonb)
    LIMIT 1
  `).catch(() => null));
  return !!r;
}

/* ── Seed default roles for an office ───────────────────────────────────── */
async function seedDefaultRoles(officeId: string): Promise<void> {
  const defaults = [
    { name: "partner",        display: "شريك / مؤسس", hierarchy: 1, perms: ["*"] },
    { name: "office_manager", display: "مدير المكتب",  hierarchy: 2, perms: ["cases:*","clients:*","invoices:*","users:view","reports:view","hr:view"] },
    { name: "lawyer",         display: "محامي",        hierarchy: 3, perms: ["cases:view","cases:create","cases:edit","clients:view","documents:*","invoices:view"] },
    { name: "accountant",     display: "محاسب",        hierarchy: 3, perms: ["invoices:*","payments:*","financial:view","reports:view"] },
    { name: "assistant",      display: "مساعد قانوني", hierarchy: 4, perms: ["cases:view","clients:view","documents:view","messages:view"] },
    { name: "intern",         display: "متدرب",        hierarchy: 5, perms: ["cases:view","clients:view"] },
  ];
  for (const r of defaults) {
    await db.execute(sql`
      INSERT INTO hr_roles (office_id, name, display_name, hierarchy, permissions, is_system)
      VALUES (${officeId}, ${r.name}, ${r.display}, ${r.hierarchy}, ${JSON.stringify(r.perms)}::jsonb, true)
      ON CONFLICT (office_id, name) DO NOTHING
    `).catch(() => {});
  }
}

/* ══════════════════════════════════════════════════════════
   ROUTES — Authorization Engine
══════════════════════════════════════════════════════════ */

// POST /api/hr-enterprise/authorize
router.post("/hr-enterprise/authorize", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { userId, permission } = req.body ?? {};
  if (!userId || !permission) { res.status(400).json({ error: "userId + permission مطلوبان" }); return; }
  try {
    const granted = await authorize(userId, tid, permission);
    res.json({ granted, userId, permission, officeId: tid });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ROUTES — RBAC (Roles & Permissions per office)
══════════════════════════════════════════════════════════ */

// GET /api/hr-enterprise/roles
router.get("/hr-enterprise/roles", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    await ensureHREnterpriseTables();
    await seedDefaultRoles(tid);
    const data = rows(await db.execute(sql`
      SELECT r.*,
             COUNT(m.id)::int AS member_count
      FROM hr_roles r
      LEFT JOIN hr_memberships m ON m.office_id = r.office_id AND m.role_name = r.name AND m.status='active'
      WHERE r.office_id = ${tid}
      GROUP BY r.id
      ORDER BY r.hierarchy ASC, r.name ASC
    `));
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/hr-enterprise/roles
router.post("/hr-enterprise/roles", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { name, displayName, description, hierarchy, permissions } = req.body ?? {};
  if (!name || !displayName) { res.status(400).json({ error: "name + displayName مطلوبان" }); return; }
  try {
    await ensureHREnterpriseTables();
    const row = one(await db.execute(sql`
      INSERT INTO hr_roles (office_id, name, display_name, description, hierarchy, permissions)
      VALUES (${tid}, ${name}, ${displayName}, ${description ?? null},
              ${hierarchy ?? 5}, ${JSON.stringify(permissions ?? [])}::jsonb)
      ON CONFLICT (office_id, name) DO UPDATE
        SET display_name = EXCLUDED.display_name, description = EXCLUDED.description,
            permissions = EXCLUDED.permissions, hierarchy = EXCLUDED.hierarchy
      RETURNING *
    `));
    await hrAuditLog({ officeId: tid, action: "role_created", targetType: "role", targetName: displayName, newValue: { name, permissions }, severity: "medium" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/hr-enterprise/roles/:name/permissions
router.patch("/hr-enterprise/roles/:name/permissions", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const roleName = String(req.params.name);
  const { permissions } = req.body ?? {};
  try {
    await ensureHREnterpriseTables();
    const old = one(await db.execute(sql`SELECT * FROM hr_roles WHERE office_id=${tid} AND name=${roleName}`));
    const row = one(await db.execute(sql`
      UPDATE hr_roles SET permissions = ${JSON.stringify(permissions ?? [])}::jsonb
      WHERE office_id = ${tid} AND name = ${roleName} RETURNING *
    `));
    await hrAuditLog({ officeId: tid, action: "permissions_updated", targetType: "role", targetName: roleName,
      oldValue: old?.permissions, newValue: permissions, severity: "high" });
    emitHRSecurityEvent("HR_PERMISSION_CHANGE", tid, { role: roleName, permissions });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ROUTES — Memberships (Office ↔ User ↔ Role)
══════════════════════════════════════════════════════════ */

// GET /api/hr-enterprise/members
router.get("/hr-enterprise/members", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    await ensureHREnterpriseTables();
    const data = rows(await db.execute(sql`
      SELECT m.*,
             r.display_name AS role_display_name,
             r.hierarchy,
             r.permissions
      FROM hr_memberships m
      LEFT JOIN hr_roles r ON r.office_id = m.office_id AND r.name = m.role_name
      WHERE m.office_id = ${tid}
      ORDER BY r.hierarchy ASC, m.joined_at DESC
    `));
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/hr-enterprise/members — add member to office
router.post("/hr-enterprise/members", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { userId, roleName, employeeId } = req.body ?? {};
  if (!userId || !roleName) { res.status(400).json({ error: "userId + roleName مطلوبان" }); return; }
  try {
    await ensureHREnterpriseTables();
    await seedDefaultRoles(tid);
    const row = one(await db.execute(sql`
      INSERT INTO hr_memberships (office_id, user_id, employee_id, role_name, status)
      VALUES (${tid}, ${userId}, ${employeeId ?? null}::uuid, ${roleName}, 'active')
      ON CONFLICT (office_id, user_id) DO UPDATE
        SET role_name = EXCLUDED.role_name, status = 'active', updated_at = NOW()
      RETURNING *
    `));
    await hrAuditLog({ officeId: tid, userId, action: "member_added", targetType: "member", targetId: userId, newValue: { roleName }, severity: "medium" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/hr-enterprise/members/:userId/role — change role
router.patch("/hr-enterprise/members/:userId/role", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const targetUserId = String(req.params.userId);
  const { roleName, reason } = req.body ?? {};
  if (!roleName) { res.status(400).json({ error: "roleName مطلوب" }); return; }
  try {
    await ensureHREnterpriseTables();
    const old = one(await db.execute(sql`SELECT * FROM hr_memberships WHERE office_id=${tid} AND user_id=${targetUserId}`));
    const row = one(await db.execute(sql`
      UPDATE hr_memberships SET role_name = ${roleName}, updated_at = NOW()
      WHERE office_id = ${tid} AND user_id = ${targetUserId} RETURNING *
    `));
    await hrAuditLog({ officeId: tid, action: "role_changed", targetType: "member", targetId: targetUserId,
      oldValue: { role: old?.role_name }, newValue: { role: roleName, reason }, severity: "high" });
    emitHRSecurityEvent("HR_ROLE_CHANGED", tid, { targetUserId, fromRole: old?.role_name, toRole: roleName });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/hr-enterprise/members/:userId/suspend
router.patch("/hr-enterprise/members/:userId/suspend", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const targetUserId = String(req.params.userId);
  try {
    await ensureHREnterpriseTables();
    const row = one(await db.execute(sql`
      UPDATE hr_memberships SET status = 'suspended', updated_at = NOW()
      WHERE office_id = ${tid} AND user_id = ${targetUserId} RETURNING *
    `));
    await hrAuditLog({ officeId: tid, action: "member_suspended", targetType: "member", targetId: targetUserId, severity: "high" });
    emitHRSecurityEvent("HR_MEMBER_SUSPENDED", tid, { targetUserId });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/hr-enterprise/members/:userId/activate
router.patch("/hr-enterprise/members/:userId/activate", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const targetUserId = String(req.params.userId);
  try {
    await ensureHREnterpriseTables();
    const row = one(await db.execute(sql`
      UPDATE hr_memberships SET status = 'active', updated_at = NOW()
      WHERE office_id = ${tid} AND user_id = ${targetUserId} RETURNING *
    `));
    await hrAuditLog({ officeId: tid, action: "member_activated", targetType: "member", targetId: targetUserId, severity: "medium" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ROUTES — HR Workflows (Approvals)
══════════════════════════════════════════════════════════ */

// GET /api/hr-enterprise/workflows
router.get("/hr-enterprise/workflows", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { status, type } = req.query as Record<string, string>;
  try {
    await ensureHREnterpriseTables();
    const data = rows(await db.execute(sql`
      SELECT * FROM hr_workflows
      WHERE office_id = ${tid}
        ${status ? sql`AND status = ${status}` : sql``}
        ${type   ? sql`AND type   = ${type}`   : sql``}
      ORDER BY
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
        created_at DESC
      LIMIT 100
    `));
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/hr-enterprise/workflows/stats
router.get("/hr-enterprise/workflows/stats", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    await ensureHREnterpriseTables();
    const r = one(await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status='approved')::int AS approved,
        COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE priority='high' OR priority='critical')::int AS high_priority,
        COUNT(*)::int AS total
      FROM hr_workflows WHERE office_id = ${tid}
    `));
    res.json(r ?? { pending: 0, approved: 0, rejected: 0, high_priority: 0, total: 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/hr-enterprise/workflows — submit workflow request
router.post("/hr-enterprise/workflows", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { type, requesterName, subjectUserId, subjectName, payload, priority, notes, expiresAt } = req.body ?? {};
  if (!type) { res.status(400).json({ error: "type مطلوب" }); return; }
  const requesterId = (req as any).userId ?? "unknown";
  try {
    await ensureHREnterpriseTables();
    const row = one(await db.execute(sql`
      INSERT INTO hr_workflows
        (office_id, type, requester_id, requester_name, subject_user_id, subject_name,
         payload, priority, notes, expires_at)
      VALUES (${tid}, ${type}, ${requesterId}, ${requesterName ?? null},
              ${subjectUserId ?? null}, ${subjectName ?? null},
              ${JSON.stringify(payload ?? {})}::jsonb,
              ${priority ?? "normal"}, ${notes ?? null},
              ${expiresAt ?? null}::timestamptz)
      RETURNING *
    `));
    const isHighPriority = priority === "high" || priority === "critical";
    if (isHighPriority) emitHRSecurityEvent("HR_HIGH_PRIORITY_REQUEST", tid, { type, requesterId, priority });
    await hrAuditLog({ officeId: tid, userId: requesterId, action: "workflow_submitted",
      targetType: "workflow", targetId: row?.id, newValue: { type, priority }, severity: isHighPriority ? "high" : "low" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/hr-enterprise/workflows/:id/approve
router.patch("/hr-enterprise/workflows/:id/approve", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { approverName, notes } = req.body ?? {};
  const approverId = (req as any).userId ?? "unknown";
  try {
    await ensureHREnterpriseTables();
    const wf = one(await db.execute(sql`SELECT * FROM hr_workflows WHERE id=${String(req.params.id)}::uuid AND office_id=${tid}`));
    if (!wf) return res.status(404).json({ error: "الطلب غير موجود" });
    const row = one(await db.execute(sql`
      UPDATE hr_workflows SET
        status = 'approved', approver_id = ${approverId}, approver_name = ${approverName ?? null},
        notes = COALESCE(${notes ?? null}, notes), reviewed_at = NOW(), updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tid} RETURNING *
    `));
    await hrAuditLog({ officeId: tid, userId: approverId, action: "workflow_approved",
      targetType: "workflow", targetId: wf.id, targetName: wf.type, severity: "medium" });
    if (wf.type === "role_change" || wf.type === "permission_upgrade")
      emitHRSecurityEvent("HR_PERMISSION_ESCALATION_APPROVED", tid, { workflowId: wf.id, type: wf.type });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/hr-enterprise/workflows/:id/reject
router.patch("/hr-enterprise/workflows/:id/reject", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { approverName, notes } = req.body ?? {};
  const approverId = (req as any).userId ?? "unknown";
  try {
    await ensureHREnterpriseTables();
    const row = one(await db.execute(sql`
      UPDATE hr_workflows SET
        status = 'rejected', approver_id = ${approverId}, approver_name = ${approverName ?? null},
        notes = COALESCE(${notes ?? null}, notes), reviewed_at = NOW(), updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tid} RETURNING *
    `));
    await hrAuditLog({ officeId: tid, userId: approverId, action: "workflow_rejected",
      targetType: "workflow", targetId: String(req.params.id), severity: "low" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ROUTES — HR Audit Logs
══════════════════════════════════════════════════════════ */

// GET /api/hr-enterprise/audit
router.get("/hr-enterprise/audit", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { severity, action } = req.query as Record<string, string>;
  try {
    await ensureHREnterpriseTables();
    const data = rows(await db.execute(sql`
      SELECT * FROM hr_audit_logs
      WHERE office_id = ${tid}
        ${severity ? sql`AND severity = ${severity}` : sql``}
        ${action   ? sql`AND action   = ${action}`   : sql``}
      ORDER BY created_at DESC LIMIT 200
    `));
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ROUTES — HR Overview Dashboard
══════════════════════════════════════════════════════════ */

// GET /api/hr-enterprise/overview
router.get("/hr-enterprise/overview", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    await ensureHREnterpriseTables();
    await seedDefaultRoles(tid);
    const [empStats, wfStats, members, auditCount] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status='active')::int AS active,
               COALESCE(SUM(CAST(salary AS NUMERIC)),0) AS payroll
        FROM employees WHERE office_id = ${tid}
      `),
      db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE status='pending')::int AS pending,
               COUNT(*) FILTER (WHERE priority IN ('high','critical'))::int AS urgent,
               COUNT(*)::int AS total
        FROM hr_workflows WHERE office_id = ${tid}
      `),
      db.execute(sql`SELECT COUNT(*)::int AS total FROM hr_memberships WHERE office_id=${tid} AND status='active'`),
      db.execute(sql`SELECT COUNT(*)::int AS total FROM hr_audit_logs WHERE office_id=${tid} AND created_at > NOW()-INTERVAL '30 days'`),
    ]);
    const e = one(empStats) ?? {};
    const w = one(wfStats) ?? {};
    const m = one(members) ?? {};
    const a = one(auditCount) ?? {};
    res.json({
      employees:  { total: e.total ?? 0, active: e.active ?? 0, payroll: num(e.payroll) },
      workflows:  { pending: w.pending ?? 0, urgent: w.urgent ?? 0, total: w.total ?? 0 },
      members:    { active: m.total ?? 0 },
      auditEvents: { last30d: a.total ?? 0 },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ROUTES — Organization Hierarchy
══════════════════════════════════════════════════════════ */

// GET /api/hr-enterprise/org-chart
router.get("/hr-enterprise/org-chart", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    await ensureHREnterpriseTables();
    await seedDefaultRoles(tid);
    const data = rows(await db.execute(sql`
      SELECT
        r.name AS role_name, r.display_name, r.hierarchy,
        COUNT(m.id)::int AS member_count,
        ARRAY_AGG(m.user_id) FILTER (WHERE m.user_id IS NOT NULL) AS user_ids
      FROM hr_roles r
      LEFT JOIN hr_memberships m ON m.office_id = r.office_id AND m.role_name = r.name AND m.status='active'
      WHERE r.office_id = ${tid}
      GROUP BY r.name, r.display_name, r.hierarchy
      ORDER BY r.hierarchy ASC
    `));
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
