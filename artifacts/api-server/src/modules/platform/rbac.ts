/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
import { requireAuth, requireAuthWithTenant, requirePermission } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db, rolesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tenantIdOf(req: any): string | null {
  const tid = req?.tenantId;
  if (!tid || !UUID_RE.test(String(tid))) return null;
  return String(tid);
}

function sqlAll(r: any): any[] {
  if (Array.isArray(r)) return r;
  if (r && Array.isArray(r.rows)) return r.rows;
  return [];
}

function sqlOne(r: any): any {
  return sqlAll(r)[0] ?? null;
}

let invitationsOfficeReady = false;
async function ensureInvitationsOfficeId() {
  if (invitationsOfficeReady) return;
  await db.execute(sql`ALTER TABLE invitations ADD COLUMN IF NOT EXISTS office_id TEXT`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_invitations_office_id ON invitations(office_id)`);
  invitationsOfficeReady = true;
}

/* ══════════════════════════════════════════════════════
   FULL PERMISSIONS MATRIX (Adalah RBAC v2)
══════════════════════════════════════════════════════ */
export const ALL_PERMISSIONS = [
  // Cases
  "cases:view", "cases:create", "cases:edit", "cases:delete", "cases:assign", "cases:close",
  // Clients
  "clients:view", "clients:create", "clients:edit", "clients:delete",
  // Contracts
  "contracts:view", "contracts:create", "contracts:edit", "contracts:delete",
  // Documents
  "documents:view", "documents:upload", "documents:edit", "documents:delete",
  // Financial
  "invoices:view", "invoices:create", "invoices:edit", "invoices:delete",
  "payments:view", "payments:create",
  "reports:view", "financial:view",
  // Payroll (new — Phase 2 RBAC)
  "payroll:view", "payroll:manage",
  // Accounting destructive ops (new — Phase 2 RBAC)
  "accounting:delete",
  // Users & Roles
  "users:view", "users:create", "users:edit", "users:delete",
  "roles:view", "roles:create", "roles:edit",
  // Settings
  "settings:view", "settings:edit",
  // AI
  "ai:access",
  // Messaging
  "messages:view", "messages:send",
  // Support
  "support:view", "support:reply",
  // Referral & Collaboration
  "referral:create", "referral:view",
  "collaborator:access",
  // Audit
  "audit:view",
  // Dashboard
  "dashboard:view",
];

/* ══════════════════════════════════════════════════════
   DEFAULT ROLES — Adalah Smart Office
══════════════════════════════════════════════════════ */
const DEFAULT_ROLES = [
  {
    name: "firm_owner",
    displayName: "مالك المكتب",
    description: "صلاحيات كاملة على جميع وظائف المنصة والمكتب",
    permissions: JSON.stringify(["*"]),
    isSystem: true,
  },
  {
    name: "office_manager",
    displayName: "مدير المكتب",
    description: "إدارة كاملة للعمليات اليومية والفريق والتقارير",
    permissions: JSON.stringify([
      "dashboard:view",
      "cases:view", "cases:create", "cases:edit", "cases:assign",
      "clients:view", "clients:create", "clients:edit",
      "contracts:view", "contracts:create", "contracts:edit",
      "documents:view", "documents:upload",
      "users:view", "users:create", "users:edit",
      "roles:view",
      "reports:view", "financial:view",
      "payroll:view", "payroll:manage",
      "invoices:view", "invoices:create", "invoices:edit",
      "payments:view",
      "settings:view",
      "ai:access",
      "messages:view", "messages:send",
    ]),
    isSystem: true,
  },
  {
    name: "lawyer",
    displayName: "محامي",
    description: "إدارة القضايا والعقود والمستندات وأدوات الذكاء الاصطناعي",
    permissions: JSON.stringify([
      "dashboard:view",
      "cases:view", "cases:create", "cases:edit",
      "clients:view",
      "contracts:view", "contracts:create", "contracts:edit",
      "documents:view", "documents:upload", "documents:edit",
      "ai:access",
      "messages:view", "messages:send",
      "invoices:view",
      "users:view",
    ]),
    isSystem: true,
  },
  {
    name: "trainee_lawyer",
    displayName: "محامي متدرب",
    description: "صلاحيات محدودة للاطلاع والمساعدة في الملفات",
    permissions: JSON.stringify([
      "dashboard:view",
      "cases:view",
      "clients:view",
      "documents:view", "documents:upload",
      "ai:access",
      "messages:view",
    ]),
    isSystem: true,
  },
  {
    name: "accountant",
    displayName: "محاسب",
    description: "الإدارة المالية الكاملة — الفواتير والمدفوعات والتقارير المالية",
    permissions: JSON.stringify([
      "dashboard:view",
      "invoices:view", "invoices:create", "invoices:edit", "invoices:delete",
      "payments:view", "payments:create",
      "reports:view", "financial:view",
      "payroll:view",
      "clients:view",
    ]),
    isSystem: true,
  },
  {
    name: "secretary",
    displayName: "سكرتير",
    description: "إدارة العملاء والوثائق والمواعيد",
    permissions: JSON.stringify([
      "dashboard:view",
      "clients:view", "clients:create",
      "documents:view", "documents:upload",
      "messages:view", "messages:send",
    ]),
    isSystem: true,
  },
  {
    name: "broker",
    displayName: "وسيط",
    description: "إحالة القضايا وتتبع العمولات والإحالات",
    permissions: JSON.stringify([
      "referral:create", "referral:view",
    ]),
    isSystem: true,
  },
  {
    name: "collaborator",
    displayName: "متعاون",
    description: "الوصول إلى المهام المُشتركة والوثائق المحددة",
    permissions: JSON.stringify([
      "collaborator:access",
      "documents:view", "documents:upload",
    ]),
    isSystem: true,
  },
  {
    name: "client",
    displayName: "عميل",
    description: "الاطلاع على القضايا الخاصة والفواتير والوثائق",
    permissions: JSON.stringify([
      "cases:view",
      "documents:view",
      "invoices:view",
    ]),
    isSystem: true,
  },
];

/* ── Sync roles: insert missing without touching existing ── */
async function syncDefaultRoles() {
  const existing = await db.select().from(rolesTable);
  const existingNames = new Set(existing.map(r => r.name));
  const toInsert = DEFAULT_ROLES.filter(r => !existingNames.has(r.name));
  if (toInsert.length > 0) {
    await db.insert(rolesTable).values(toInsert);
  }
}

async function logAudit(
  officeId: string | null | undefined,
  action: string,
  resource: string,
  resourceId?: string,
  details?: string,
  userId?: string,
  userFullName?: string,
) {
  if (officeId) {
    await db.execute(sql`
      INSERT INTO audit_logs (office_id, action, resource, resource_id, details, user_id, user_full_name)
      VALUES (${officeId}, ${action}, ${resource}, ${resourceId ?? null}, ${details ?? null}, ${userId ?? null}, ${userFullName ?? null})
    `);
    return;
  }
  await db.execute(sql`
    INSERT INTO audit_logs (action, resource, resource_id, details, user_id, user_full_name)
    VALUES (${action}, ${resource}, ${resourceId ?? null}, ${details ?? null}, ${userId ?? null}, ${userFullName ?? null})
  `);
}

// ─── ROLES ──────────────────────────────────────────────────────────────────

router.get("/rbac/roles", requireAuthWithTenant, async (_req, res) => {
  try {
    await syncDefaultRoles();
    const roles = await db.select().from(rolesTable).orderBy(rolesTable.createdAt);
    res.json(roles.map(r => ({
      ...r,
      permissions: JSON.parse(r.permissions) as string[],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/rbac/roles", requireAuthWithTenant, requirePermission("roles:create"), async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { name, displayName, description, permissions } = req.body as {
      name: string; displayName: string; description?: string; permissions: string[];
    };
    if (!name || !displayName) return res.status(400).json({ error: "الاسم والعنوان مطلوبان" });

    const [created] = await db.insert(rolesTable).values({
      name, displayName, description,
      permissions: JSON.stringify(permissions ?? []),
      isSystem: false,
    }).returning();

    await logAudit(officeId, "create", "role", created.id, `إنشاء دور: ${displayName}`);
    res.status(201).json({ ...created, permissions: JSON.parse(created.permissions) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/rbac/roles/:id", requireAuthWithTenant, requirePermission("roles:edit"), async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { displayName, description, permissions } = req.body as {
      displayName?: string; description?: string; permissions?: string[];
    };

    const existing = await db.select().from(rolesTable).where(eq(rolesTable.id, String(req.params.id))).limit(1);
    if (!existing.length) return res.status(404).json({ error: "الدور غير موجود" });
    if (existing[0].isSystem && permissions) {
      return res.status(403).json({ error: "لا يمكن تعديل صلاحيات الأدوار الأساسية" });
    }

    const [updated] = await db.update(rolesTable).set({
      ...(displayName !== undefined && { displayName }),
      ...(description !== undefined && { description }),
      ...(permissions !== undefined && { permissions: JSON.stringify(permissions) }),
      updatedAt: new Date(),
    }).where(eq(rolesTable.id, String(req.params.id))).returning();

    await logAudit(officeId, "update", "role", updated.id, `تعديل دور: ${updated.displayName}`);
    res.json({ ...updated, permissions: JSON.parse(updated.permissions) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/rbac/roles/:id", requireAuthWithTenant, requirePermission("roles:edit"), async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const existing = await db.select().from(rolesTable).where(eq(rolesTable.id, String(req.params.id))).limit(1);
    if (!existing.length) return res.status(404).json({ error: "الدور غير موجود" });
    if (existing[0].isSystem) return res.status(403).json({ error: "لا يمكن حذف الأدوار الأساسية" });

    await db.delete(rolesTable).where(eq(rolesTable.id, String(req.params.id)));
    await logAudit(officeId, "delete", "role", String(req.params.id), `حذف دور: ${existing[0].displayName}`);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── INVITATIONS ────────────────────────────────────────────────────────────

router.get("/rbac/invitations", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    await ensureInvitationsOfficeId();
    const invitations = sqlAll(await db.execute(sql`
      SELECT id, email, role, token, status, invited_by, created_at, expires_at, office_id
      FROM invitations
      WHERE office_id = ${officeId}
      ORDER BY created_at DESC
    `));
    res.json(invitations.map((i: any) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token,
      status: i.status,
      invitedBy: i.invited_by,
      officeId: i.office_id,
      createdAt: new Date(i.created_at).toISOString(),
      expiresAt: new Date(i.expires_at).toISOString(),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/rbac/invitations", requireAuthWithTenant, requirePermission("users:create"), async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    await ensureInvitationsOfficeId();
    const { email, role, invitedBy } = req.body as { email: string; role: string; invitedBy?: string };
    if (!email || !role) return res.status(400).json({ error: "البريد الإلكتروني والدور مطلوبان" });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const created = sqlOne(await db.execute(sql`
      INSERT INTO invitations (email, role, invited_by, status, expires_at, office_id)
      VALUES (${email}, ${role}, ${invitedBy ?? null}, 'pending', ${expiresAt.toISOString()}::timestamptz, ${officeId})
      RETURNING id, email, role, token, status, invited_by, created_at, expires_at, office_id
    `));
    if (!created) return res.status(500).json({ error: "فشل إنشاء الدعوة" });

    await logAudit(officeId, "invite", "user", undefined, `دعوة مستخدم: ${email} بدور ${role}`, invitedBy);
    res.status(201).json({
      id: created.id,
      email: created.email,
      role: created.role,
      token: created.token,
      status: created.status,
      invitedBy: created.invited_by,
      officeId: created.office_id,
      createdAt: new Date(created.created_at).toISOString(),
      expiresAt: new Date(created.expires_at).toISOString(),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/rbac/invitations/:id/resend", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    await ensureInvitationsOfficeId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = sqlOne(await db.execute(sql`
      UPDATE invitations
      SET status = 'pending', expires_at = ${expiresAt.toISOString()}::timestamptz
      WHERE id = ${String(req.params.id)} AND office_id = ${officeId}
      RETURNING id, email, role, token, status, invited_by, created_at, expires_at, office_id
    `));
    if (!updated) return res.status(404).json({ error: "الدعوة غير موجودة" });
    res.json({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      token: updated.token,
      status: updated.status,
      invitedBy: updated.invited_by,
      officeId: updated.office_id,
      createdAt: new Date(updated.created_at).toISOString(),
      expiresAt: new Date(updated.expires_at).toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/rbac/invitations/:id", requireAuthWithTenant, requirePermission("users:create"), async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    await ensureInvitationsOfficeId();
    const deleted = sqlOne(await db.execute(sql`
      DELETE FROM invitations
      WHERE id = ${String(req.params.id)} AND office_id = ${officeId}
      RETURNING id
    `));
    if (!deleted) return res.status(404).json({ error: "الدعوة غير موجودة" });
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── AUDIT LOGS ─────────────────────────────────────────────────────────────

router.get("/rbac/audit-logs", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const logs = sqlAll(await db.execute(sql`
      SELECT id, user_id, user_full_name, action, resource, resource_id, details, created_at, office_id
      FROM audit_logs
      WHERE office_id = ${officeId}
      ORDER BY created_at DESC
      LIMIT 100
    `));
    res.json(logs.map((l: any) => ({
      id: l.id,
      userId: l.user_id,
      userFullName: l.user_full_name,
      action: l.action,
      resource: l.resource,
      resourceId: l.resource_id,
      details: l.details,
      officeId: l.office_id,
      createdAt: new Date(l.created_at).toISOString(),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── USER ROLE / STATUS UPDATE ───────────────────────────────────────────────

router.patch("/rbac/users/:id/role", requireAuthWithTenant, requirePermission("roles:edit"), async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { role } = req.body as { role: string };
    if (!role) return res.status(400).json({ error: "الدور مطلوب" });

    const member = sqlOne(await db.execute(sql`
      SELECT om.user_id FROM office_members om
      JOIN users u ON (u.clerk_id = om.user_id OR u.id = om.user_id)
      WHERE (u.id = ${String(req.params.id)} OR u.clerk_id = ${String(req.params.id)})
        AND om.office_id = ${officeId}
      LIMIT 1
    `));
    if (!member) return res.status(404).json({ error: "المستخدم غير موجود في هذا المكتب" });

    const [updated] = await db.update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, String(req.params.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "المستخدم غير موجود" });
    await logAudit(officeId, "update_role", "user", String(req.params.id), `تغيير دور ${updated.fullName} إلى ${role}`);
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/rbac/users/:id/status", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { status } = req.body as { status: string };

    const member = sqlOne(await db.execute(sql`
      SELECT om.user_id FROM office_members om
      JOIN users u ON (u.clerk_id = om.user_id OR u.id = om.user_id)
      WHERE (u.id = ${String(req.params.id)} OR u.clerk_id = ${String(req.params.id)})
        AND om.office_id = ${officeId}
      LIMIT 1
    `));
    if (!member) return res.status(404).json({ error: "المستخدم غير موجود في هذا المكتب" });

    const [updated] = await db.update(usersTable)
      .set({ status })
      .where(eq(usersTable.id, String(req.params.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: "المستخدم غير موجود" });
    await logAudit(officeId, "update_status", "user", String(req.params.id), `تغيير حالة ${updated.fullName} إلى ${status}`);
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export const ALL_PERMISSIONS_LIST = ALL_PERMISSIONS;
router.get("/rbac/permissions", requireAuth, (_req, res) => {
  res.json(ALL_PERMISSIONS);
});

// ─── MY PERMISSIONS (current user) ──────────────────────────────────────────
router.get("/rbac/my-permissions", requireAuthWithTenant, async (req, res) => {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId;
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const officeId = tenantIdOf(req);
    if (!officeId) return res.json({ role: "guest", displayName: "زائر", permissions: [] });

    const mArr = sqlAll(await db.execute(sql`
      SELECT role FROM office_members
      WHERE user_id = ${userId} AND office_id = ${officeId} AND status = 'active'
      LIMIT 1
    `));
    const roleName: string = mArr[0]?.role ?? "lawyer";

    await syncDefaultRoles();
    const roleRows = await db.select().from(rolesTable).where(eq(rolesTable.name, roleName)).limit(1);
    const roleData = roleRows[0];
    const permissions: string[] = roleData ? JSON.parse(roleData.permissions) : [];

    res.json({ role: roleName, displayName: roleData?.displayName ?? roleName, permissions, officeId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── OFFICE MEMBERS LIST ─────────────────────────────────────────────────────
router.get("/rbac/members", requireAuthWithTenant, async (req, res) => {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId;
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });

    const members = sqlAll(await db.execute(sql`
      SELECT
        om.user_id, om.role, om.status, om.created_at AS joined_at,
        u.full_name, u.email, u.avatar_url
      FROM office_members om
      LEFT JOIN users u ON u.clerk_id = om.user_id
      WHERE om.office_id = ${officeId}
      ORDER BY om.created_at ASC
    `));

    await syncDefaultRoles();
    const allRoles = await db.select().from(rolesTable);
    const roleMap = Object.fromEntries(allRoles.map(r => [r.name, r.displayName]));

    res.json(members.map((m: any) => ({
      ...m,
      roleDisplayName: roleMap[m.role] ?? m.role,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── UPDATE MEMBER ROLE ───────────────────────────────────────────────────────
router.patch("/rbac/members/:memberId/role", requireAuthWithTenant, requirePermission("users:edit"), async (req, res) => {
  try {
    const auth = getAuth(req);
    const currentUserId = auth?.userId;
    if (!currentUserId) return res.status(401).json({ error: "غير مصرح" });

    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });

    const { role } = req.body as { role: string };
    if (!role) return res.status(400).json({ error: "الدور مطلوب" });

    const updated = sqlOne(await db.execute(sql`
      UPDATE office_members SET role = ${role}
      WHERE user_id = ${String(req.params.memberId)} AND office_id = ${officeId}
      RETURNING user_id
    `));
    if (!updated) return res.status(404).json({ error: "العضو غير موجود" });

    await logAudit(officeId, "update_role", "member", String(req.params.memberId), `تغيير الدور إلى ${role}`, currentUserId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REMOVE MEMBER ────────────────────────────────────────────────────────────
router.delete("/rbac/members/:memberId", requireAuthWithTenant, requirePermission("users:delete"), async (req, res) => {
  try {
    const auth = getAuth(req);
    const currentUserId = auth?.userId;
    if (!currentUserId) return res.status(401).json({ error: "غير مصرح" });

    if (String(req.params.memberId) === currentUserId) {
      return res.status(400).json({ error: "لا يمكنك إزالة نفسك من المكتب" });
    }

    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });

    const updated = sqlOne(await db.execute(sql`
      UPDATE office_members SET status = 'inactive'
      WHERE user_id = ${String(req.params.memberId)} AND office_id = ${officeId}
      RETURNING user_id
    `));
    if (!updated) return res.status(404).json({ error: "العضو غير موجود" });

    await logAudit(officeId, "remove_member", "member", String(req.params.memberId), "إزالة عضو من المكتب", currentUserId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
