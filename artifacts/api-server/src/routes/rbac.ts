import { Router } from "express";
import { db, rolesTable, invitationsTable, auditLogsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

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
      "invoices:view", "invoices:create", "invoices:edit",
      "payments:view", "payments:create",
      "reports:view", "financial:view",
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
  action: string,
  resource: string,
  resourceId?: string,
  details?: string,
  userId?: string,
  userFullName?: string,
) {
  await db.insert(auditLogsTable).values({ action, resource, resourceId, details, userId, userFullName });
}

// ─── ROLES ──────────────────────────────────────────────────────────────────

router.get("/rbac/roles", async (_req, res) => {
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

router.post("/rbac/roles", async (req, res) => {
  try {
    const { name, displayName, description, permissions } = req.body as {
      name: string; displayName: string; description?: string; permissions: string[];
    };
    if (!name || !displayName) return res.status(400).json({ error: "الاسم والعنوان مطلوبان" });

    const [created] = await db.insert(rolesTable).values({
      name, displayName, description,
      permissions: JSON.stringify(permissions ?? []),
      isSystem: false,
    }).returning();

    await logAudit("create", "role", created.id, `إنشاء دور: ${displayName}`);
    res.status(201).json({ ...created, permissions: JSON.parse(created.permissions) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/rbac/roles/:id", async (req, res) => {
  try {
    const { displayName, description, permissions } = req.body as {
      displayName?: string; description?: string; permissions?: string[];
    };

    const existing = await db.select().from(rolesTable).where(eq(rolesTable.id, req.params.id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "الدور غير موجود" });
    if (existing[0].isSystem && permissions) {
      return res.status(403).json({ error: "لا يمكن تعديل صلاحيات الأدوار الأساسية" });
    }

    const [updated] = await db.update(rolesTable).set({
      ...(displayName !== undefined && { displayName }),
      ...(description !== undefined && { description }),
      ...(permissions !== undefined && { permissions: JSON.stringify(permissions) }),
      updatedAt: new Date(),
    }).where(eq(rolesTable.id, req.params.id)).returning();

    await logAudit("update", "role", updated.id, `تعديل دور: ${updated.displayName}`);
    res.json({ ...updated, permissions: JSON.parse(updated.permissions) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/rbac/roles/:id", async (req, res) => {
  try {
    const existing = await db.select().from(rolesTable).where(eq(rolesTable.id, req.params.id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "الدور غير موجود" });
    if (existing[0].isSystem) return res.status(403).json({ error: "لا يمكن حذف الأدوار الأساسية" });

    await db.delete(rolesTable).where(eq(rolesTable.id, req.params.id));
    await logAudit("delete", "role", req.params.id, `حذف دور: ${existing[0].displayName}`);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── INVITATIONS ────────────────────────────────────────────────────────────

router.get("/rbac/invitations", async (_req, res) => {
  try {
    const invitations = await db.select().from(invitationsTable).orderBy(desc(invitationsTable.createdAt));
    res.json(invitations.map(i => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/rbac/invitations", async (req, res) => {
  try {
    const { email, role, invitedBy } = req.body as { email: string; role: string; invitedBy?: string };
    if (!email || !role) return res.status(400).json({ error: "البريد الإلكتروني والدور مطلوبان" });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [created] = await db.insert(invitationsTable).values({
      email, role, invitedBy, status: "pending", expiresAt,
    }).returning();

    await logAudit("invite", "user", undefined, `دعوة مستخدم: ${email} بدور ${role}`, invitedBy);
    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString(), expiresAt: created.expiresAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/rbac/invitations/:id/resend", async (req, res) => {
  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [updated] = await db.update(invitationsTable)
      .set({ status: "pending", expiresAt })
      .where(eq(invitationsTable.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "الدعوة غير موجودة" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), expiresAt: updated.expiresAt.toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/rbac/invitations/:id", async (req, res) => {
  try {
    await db.delete(invitationsTable).where(eq(invitationsTable.id, req.params.id));
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── AUDIT LOGS ─────────────────────────────────────────────────────────────

router.get("/rbac/audit-logs", async (_req, res) => {
  try {
    const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(100);
    res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── USER ROLE / STATUS UPDATE ───────────────────────────────────────────────

router.patch("/rbac/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body as { role: string };
    if (!role) return res.status(400).json({ error: "الدور مطلوب" });

    const [updated] = await db.update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "المستخدم غير موجود" });
    await logAudit("update_role", "user", req.params.id, `تغيير دور ${updated.fullName} إلى ${role}`);
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/rbac/users/:id/status", async (req, res) => {
  try {
    const { status } = req.body as { status: string };
    const [updated] = await db.update(usersTable)
      .set({ status })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "المستخدم غير موجود" });
    await logAudit("update_status", "user", req.params.id, `تغيير حالة ${updated.fullName} إلى ${status}`);
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export const ALL_PERMISSIONS_LIST = ALL_PERMISSIONS;
router.get("/rbac/permissions", (_req, res) => {
  res.json(ALL_PERMISSIONS);
});

export default router;
