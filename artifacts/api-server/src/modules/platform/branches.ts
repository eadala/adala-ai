import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
/* ── inline branch limit lookup (mirrors plan-features.ts) ── */
const BRANCH_LIMITS: Record<string, number | "unlimited"> = {
  free: 0, starter: 0, basic: 0,
  professional: 3, growth: 10,
  enterprise: "unlimited", ultimate: "unlimited", white_label: "unlimited",
};
function getPlanBranchLimit(plan?: string | null): number | "unlimited" {
  return BRANCH_LIMITS[plan ?? "free"] ?? 0;
}

const router = Router();

async function sqlAll(q: any): Promise<any[]> {
  const r = await db.execute(q) as any;
  return (r?.rows ?? r) as any[];
}
async function sqlOne(q: any): Promise<any> {
  return (await sqlAll(q))[0] ?? null;
}

async function isSuperAdmin(req: any): Promise<boolean> {
  try {
    const meta = req.auth?.sessionClaims?.publicMetadata as any;
    if (meta?.role === "super_admin") return true;
    const emails = process.env.VITE_SUPER_ADMIN_EMAILS?.split(",").map(e => e.trim()) ?? [];
    const userEmail = req.auth?.sessionClaims?.email as string ?? "";
    return emails.includes(userEmail);
  } catch { return false; }
}

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS office_branches (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      code        TEXT,
      location    TEXT,
      description TEXT,
      phone       TEXT,
      email       TEXT,
      manager_user_id TEXT,
      manager_name    TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_office_branches_office ON office_branches(office_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_office_branches_status ON office_branches(office_id, status)`);

  await db.execute(sql`ALTER TABLE cases ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES office_branches(id) ON DELETE SET NULL`);
  await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES office_branches(id) ON DELETE SET NULL`);
  await db.execute(sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES office_branches(id) ON DELETE SET NULL`);
  await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES office_branches(id) ON DELETE SET NULL`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cases_branch ON cases(branch_id) WHERE branch_id IS NOT NULL`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_clients_branch ON clients(branch_id) WHERE branch_id IS NOT NULL`);
}

ensureTables().catch(console.error);

async function getOfficePlan(officeId: string): Promise<string> {
  const row = await sqlOne(sql`SELECT plan FROM office_page WHERE id::text = ${officeId} OR slug = ${officeId} LIMIT 1`);
  return row?.plan ?? "free";
}

/* ─── GET /api/branches ─────────────────────────────────── */
router.get("/branches", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const branches = await sqlAll(sql`
      SELECT
        b.*,
        COUNT(DISTINCT c.id)::int   AS cases_count,
        COUNT(DISTINCT cl.id)::int  AS clients_count,
        COUNT(DISTINCT t.id)::int   AS tasks_count
      FROM office_branches b
      LEFT JOIN cases c         ON c.branch_id  = b.id AND c.status != 'deleted'
      LEFT JOIN clients cl      ON cl.branch_id = b.id
      LEFT JOIN tasks t         ON t.branch_id  = b.id AND t.status != 'done'
      WHERE b.office_id = ${officeId}
      GROUP BY b.id
      ORDER BY b.created_at ASC
    `);
    const plan = await getOfficePlan(officeId);
    const branchLimit = getPlanBranchLimit(plan);
    res.json({ branches, plan, branchLimit });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/branches/:id ─────────────────────────────── */
router.get("/branches/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const id = String(req.params.id);
    const branch = await sqlOne(sql`SELECT * FROM office_branches WHERE id = ${id}::uuid AND office_id = ${officeId}`);
    if (!branch) return res.status(404).json({ error: "الفرع غير موجود" });
    res.json(branch);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/branches/:id/stats ───────────────────────── */
router.get("/branches/:id/stats", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const id = String(req.params.id);
    const branch = await sqlOne(sql`SELECT id FROM office_branches WHERE id = ${id}::uuid AND office_id = ${officeId}`);
    if (!branch) return res.status(404).json({ error: "الفرع غير موجود" });

    const [cases, clients, invoices, openTasks, aiUsage] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE status='closed')::int AS closed
        FROM cases WHERE branch_id = ${id}::uuid`),
      sqlOne(sql`SELECT COUNT(*)::int AS total FROM clients WHERE branch_id = ${id}::uuid`),
      sqlOne(sql`SELECT COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN status='paid' THEN total_amount ELSE 0 END),0)::numeric AS revenue
        FROM client_invoices WHERE branch_id = ${id}::uuid`),
      sqlOne(sql`SELECT COUNT(*)::int AS total FROM tasks WHERE branch_id = ${id}::uuid AND status != 'done'`),
      sqlOne(sql`SELECT COUNT(*)::int AS requests,
        COALESCE(SUM(cost_points),0)::int AS cost_points
        FROM ai_usage_logs WHERE office_id = ${officeId} AND created_at > NOW() - INTERVAL '30 days'`),
    ]);

    res.json({
      cases:    cases    ?? { total: 0, active: 0, closed: 0 },
      clients:  clients  ?? { total: 0 },
      invoices: invoices ?? { total: 0, revenue: 0 },
      tasks:    openTasks ?? { total: 0 },
      aiUsage:  aiUsage  ?? { requests: 0, cost_points: 0 },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /api/branches ────────────────────────────────── */
router.post("/branches", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { name, code, location, description, phone, email, manager_user_id, manager_name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "اسم الفرع مطلوب" });

    const plan = await getOfficePlan(officeId);
    const branchLimit = getPlanBranchLimit(plan);
    const existing = await sqlOne(sql`SELECT COUNT(*)::int AS cnt FROM office_branches WHERE office_id = ${officeId}`);
    const currentCount = existing?.cnt ?? 0;

    if (branchLimit !== "unlimited" && currentCount >= (branchLimit as number)) {
      return res.status(403).json({
        error: `تم الوصول للحد الأقصى من الفروع (${branchLimit}) في باقتك الحالية. يرجى الترقية للحصول على المزيد.`,
        limitReached: true,
        current: currentCount,
        limit: branchLimit,
        plan,
      });
    }

    if (code) {
      const dup = await sqlOne(sql`SELECT id FROM office_branches WHERE office_id = ${officeId} AND code = ${code.trim()}`);
      if (dup) return res.status(409).json({ error: "كود الفرع مستخدم بالفعل" });
    }

    const branch = await sqlOne(sql`
      INSERT INTO office_branches (office_id, name, code, location, description, phone, email, manager_user_id, manager_name)
      VALUES (${officeId}, ${name.trim()}, ${code?.trim() ?? null}, ${location?.trim() ?? null},
              ${description?.trim() ?? null}, ${phone?.trim() ?? null}, ${email?.trim() ?? null},
              ${manager_user_id ?? null}, ${manager_name?.trim() ?? null})
      RETURNING *
    `);
    res.status(201).json(branch);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── PATCH /api/branches/:id ───────────────────────────── */
router.patch("/branches/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const id = String(req.params.id);
    const { name, code, location, description, phone, email, manager_user_id, manager_name, status } = req.body;

    const existing = await sqlOne(sql`SELECT id FROM office_branches WHERE id = ${id}::uuid AND office_id = ${officeId}`);
    if (!existing) return res.status(404).json({ error: "الفرع غير موجود" });

    const branch = await sqlOne(sql`
      UPDATE office_branches SET
        name            = COALESCE(${name?.trim() ?? null},            name),
        code            = COALESCE(${code?.trim() ?? null},            code),
        location        = COALESCE(${location?.trim() ?? null},        location),
        description     = COALESCE(${description?.trim() ?? null},     description),
        phone           = COALESCE(${phone?.trim() ?? null},           phone),
        email           = COALESCE(${email?.trim() ?? null},           email),
        manager_user_id = COALESCE(${manager_user_id ?? null},         manager_user_id),
        manager_name    = COALESCE(${manager_name?.trim() ?? null},    manager_name),
        status          = COALESCE(${status ?? null},                  status),
        updated_at      = NOW()
      WHERE id = ${id}::uuid AND office_id = ${officeId}
      RETURNING *
    `);
    res.json(branch);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── DELETE /api/branches/:id ──────────────────────────── */
router.delete("/branches/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const id = String(req.params.id);
    const branch = await sqlOne(sql`SELECT id FROM office_branches WHERE id = ${id}::uuid AND office_id = ${officeId}`);
    if (!branch) return res.status(404).json({ error: "الفرع غير موجود" });

    const linked = await sqlOne(sql`SELECT COUNT(*)::int AS cnt FROM cases WHERE branch_id = ${id}::uuid AND status != 'deleted'`);
    if ((linked?.cnt ?? 0) > 0) {
      return res.status(409).json({
        error: `لا يمكن حذف الفرع — يحتوي على ${linked.cnt} قضية نشطة. يرجى تحويل القضايا أولاً.`,
        activeCases: linked.cnt,
      });
    }

    await db.execute(sql`UPDATE office_branches SET status = 'inactive', updated_at = NOW() WHERE id = ${id}::uuid AND office_id = ${officeId}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /api/branches/transfer-case ──────────────────── */
router.post("/branches/transfer-case", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { case_id, target_branch_id } = req.body;
    if (!case_id) return res.status(400).json({ error: "معرّف القضية مطلوب" });

    const caseRow = await sqlOne(sql`SELECT id, title, branch_id FROM cases WHERE id = ${case_id}::uuid AND office_id = ${officeId}`);
    if (!caseRow) return res.status(404).json({ error: "القضية غير موجودة" });

    if (target_branch_id) {
      const branch = await sqlOne(sql`SELECT id FROM office_branches WHERE id = ${target_branch_id}::uuid AND office_id = ${officeId} AND status = 'active'`);
      if (!branch) return res.status(404).json({ error: "الفرع المستهدف غير موجود أو غير نشط" });
    }

    await db.execute(sql`
      UPDATE cases SET branch_id = ${target_branch_id ? target_branch_id + '::uuid' : null}, updated_at = NOW()
      WHERE id = ${case_id}::uuid AND office_id = ${officeId}
    `);
    res.json({ success: true, case_id, target_branch_id: target_branch_id ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /api/branches/assign-client ──────────────────── */
router.post("/branches/assign-client", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { client_id, branch_id } = req.body;
    if (!client_id) return res.status(400).json({ error: "معرّف العميل مطلوب" });

    const client = await sqlOne(sql`SELECT id FROM clients WHERE id = ${parseInt(client_id)} AND office_id = ${officeId}`);
    if (!client) return res.status(404).json({ error: "العميل غير موجود" });

    if (branch_id) {
      const branch = await sqlOne(sql`SELECT id FROM office_branches WHERE id = ${branch_id}::uuid AND office_id = ${officeId}`);
      if (!branch) return res.status(404).json({ error: "الفرع غير موجود" });
    }

    await db.execute(sql`UPDATE clients SET branch_id = ${branch_id ? branch_id + '::uuid' : null} WHERE id = ${parseInt(client_id)} AND office_id = ${officeId}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/branches/dashboard ───────────────────────── */
router.get("/branches/dashboard", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const [summary, topByRevenue, recentActivity] = await Promise.all([
      sqlOne(sql`
        SELECT
          COUNT(*)::int                                        AS total_branches,
          COUNT(*) FILTER (WHERE status='active')::int        AS active_branches,
          COUNT(DISTINCT c.id)::int                           AS total_cases,
          COUNT(DISTINCT cl.id)::int                          AS total_clients
        FROM office_branches b
        LEFT JOIN cases c    ON c.branch_id  = b.id AND c.status != 'deleted'
        LEFT JOIN clients cl ON cl.branch_id = b.id
        WHERE b.office_id = ${officeId}
      `),
      sqlAll(sql`
        SELECT b.id, b.name, b.location, b.status,
          COUNT(DISTINCT c.id)::int                                                        AS cases_count,
          COUNT(DISTINCT cl.id)::int                                                       AS clients_count,
          COALESCE(SUM(CASE WHEN inv.status='paid' THEN inv.total_amount ELSE 0 END),0)::numeric AS revenue
        FROM office_branches b
        LEFT JOIN cases c           ON c.branch_id  = b.id AND c.status != 'deleted'
        LEFT JOIN clients cl        ON cl.branch_id = b.id
        LEFT JOIN client_invoices inv ON inv.branch_id = b.id
        WHERE b.office_id = ${officeId} AND b.status = 'active'
        GROUP BY b.id, b.name, b.location, b.status
        ORDER BY revenue DESC
        LIMIT 5
      `),
      sqlAll(sql`
        SELECT b.id, b.name,
          COUNT(c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '7 days')::int AS new_cases_this_week
        FROM office_branches b
        LEFT JOIN cases c ON c.branch_id = b.id
        WHERE b.office_id = ${officeId}
        GROUP BY b.id, b.name
        ORDER BY new_cases_this_week DESC
        LIMIT 5
      `),
    ]);

    const plan = await getOfficePlan(officeId);
    const branchLimit = getPlanBranchLimit(plan);

    res.json({
      summary: summary ?? { total_branches: 0, active_branches: 0, total_cases: 0, total_clients: 0 },
      topByRevenue,
      recentActivity,
      plan,
      branchLimit,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/admin/branches — Super Admin ─────────────── */
router.get("/admin/branches", requireAuth, async (req, res) => {
  try {
    if (!(await isSuperAdmin(req))) return res.status(403).json({ error: "غير مصرح" });

    const branches = await sqlAll(sql`
      SELECT
        b.*,
        op.name  AS office_name,
        op.plan  AS office_plan,
        COUNT(DISTINCT c.id)::int  AS cases_count,
        COUNT(DISTINCT cl.id)::int AS clients_count
      FROM office_branches b
      LEFT JOIN office_page op ON op.id::text = b.office_id
      LEFT JOIN cases c        ON c.branch_id  = b.id
      LEFT JOIN clients cl     ON cl.branch_id = b.id
      GROUP BY b.id, op.name, op.plan
      ORDER BY b.created_at DESC
      LIMIT 200
    `);

    const stats = await sqlOne(sql`
      SELECT
        COUNT(*)::int                                  AS total,
        COUNT(*) FILTER (WHERE status='active')::int   AS active,
        COUNT(DISTINCT office_id)                      AS offices_with_branches
      FROM office_branches
    `);

    res.json({ branches, stats: stats ?? { total: 0, active: 0, offices_with_branches: 0 } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
