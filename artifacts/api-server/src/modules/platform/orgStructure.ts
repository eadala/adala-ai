/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ══════════════════════════════════════════════
   ENSURE TABLES
══════════════════════════════════════════════ */
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organization_units (
      id          SERIAL PRIMARY KEY,
      firm_id     TEXT NOT NULL DEFAULT 'default',
      office_id   TEXT NOT NULL DEFAULT 'default',
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'DEPARTMENT',
      parent_id   INTEGER REFERENCES organization_units(id) ON DELETE SET NULL,
      manager_id  TEXT,
      manager_name TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  /* Backfill office_id for older installs that only had firm_id */
  await db.execute(sql`ALTER TABLE organization_units ADD COLUMN IF NOT EXISTS office_id TEXT`).catch(() => {});
  await db.execute(sql`
    UPDATE organization_units
    SET office_id = COALESCE(NULLIF(office_id, ''), NULLIF(firm_id, ''), 'default')
    WHERE office_id IS NULL OR office_id = ''
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_org_units_office ON organization_units(office_id)`).catch(() => {});
}

async function sqlAll(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function sqlOne(q: any): Promise<any> {
  const rows = await sqlAll(q);
  return rows[0] ?? null;
}

function tenantIdOf(req: any): string | null {
  const tid = req?.tenantId as string | undefined;
  if (!tid || tid === "default" || tid === "platform" || tid === "unknown") return null;
  return tid;
}

/* ══════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════ */

/* GET all units */
router.get("/org-units", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = tenantIdOf(req);
  if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
  try {
    const units = await sqlAll(sql`
      SELECT * FROM organization_units
      WHERE office_id = ${tid}
      ORDER BY created_at ASC
    `);
    res.json(units);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET single unit */
router.get("/org-units/:id", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = tenantIdOf(req);
  if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
  try {
    const unit = await sqlOne(sql`
      SELECT * FROM organization_units
      WHERE id = ${parseInt(String(req.params.id))} AND office_id = ${tid}
    `);
    if (!unit) return res.status(404).json({ error: "الوحدة غير موجودة" });
    res.json(unit);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET unit stats */
router.get("/org-units/:id/stats", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = tenantIdOf(req);
  if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
  const id = parseInt(String(req.params.id));
  try {
    const owned = await sqlOne(sql`
      SELECT id FROM organization_units WHERE id = ${id} AND office_id = ${tid}
    `);
    if (!owned) return res.status(404).json({ error: "الوحدة غير موجودة" });

    const [cases, clients, contracts, invoicesAgg] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*)::int as count FROM cases WHERE organization_unit_id = ${id} AND office_id = ${tid} AND status != 'deleted'`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM clients WHERE organization_unit_id = ${id} AND office_id = ${tid}`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM contracts WHERE organization_unit_id = ${id} AND office_id = ${tid}`),
      sqlOne(sql`SELECT COUNT(*)::int as count, COALESCE(SUM(CASE WHEN status='paid' THEN total_amount ELSE 0 END),0) as revenue FROM client_invoices WHERE organization_unit_id = ${id} AND office_id = ${tid}`),
    ]);
    res.json({
      cases:     cases?.count ?? 0,
      clients:   clients?.count ?? 0,
      contracts: contracts?.count ?? 0,
      invoices:  invoicesAgg?.count ?? 0,
      revenue:   invoicesAgg?.revenue ?? 0,
    });
  } catch { res.json({ cases: 0, clients: 0, contracts: 0, invoices: 0, revenue: 0 }); }
});

/* GET dashboard aggregate stats */
router.get("/org-units-dashboard", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = tenantIdOf(req);
  if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
  try {
    const [total, active, byType, topUnits] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*)::int as count FROM organization_units WHERE office_id = ${tid}`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM organization_units WHERE office_id = ${tid} AND status = 'active'`),
      sqlAll(sql`SELECT type, COUNT(*)::int as count FROM organization_units WHERE office_id = ${tid} GROUP BY type ORDER BY count DESC`),
      sqlAll(sql`
        SELECT o.id, o.name, o.type, o.status,
          (SELECT COUNT(*)::int FROM cases c WHERE c.organization_unit_id = o.id AND c.office_id = ${tid}) as cases_count,
          (SELECT COUNT(*)::int FROM clients cl WHERE cl.organization_unit_id = o.id AND cl.office_id = ${tid}) as clients_count
        FROM organization_units o
        WHERE o.status = 'active' AND o.office_id = ${tid}
        ORDER BY cases_count DESC
        LIMIT 8
      `),
    ]);
    res.json({
      total:    total?.count ?? 0,
      active:   active?.count ?? 0,
      byType,
      topUnits,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST create unit */
router.post("/org-units", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = tenantIdOf(req);
  if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
  try {
    const { name, type, parentId, managerId, managerName, description } = req.body as {
      name: string; type: string; parentId?: number | null;
      managerId?: string; managerName?: string; description?: string;
    };
    if (!name) return res.status(400).json({ error: "اسم الوحدة مطلوب" });

    if (parentId != null) {
      const parent = await sqlOne(sql`
        SELECT id FROM organization_units WHERE id = ${parentId} AND office_id = ${tid}
      `);
      if (!parent) return res.status(400).json({ error: "الوحدة الأب غير موجودة في هذا المكتب" });
    }

    const unit = await sqlOne(sql`
      INSERT INTO organization_units (firm_id, office_id, name, type, parent_id, manager_id, manager_name, description, status)
      VALUES (${tid}, ${tid}, ${name}, ${type ?? 'DEPARTMENT'}, ${parentId ?? null}, ${managerId ?? null}, ${managerName ?? null}, ${description ?? null}, 'active')
      RETURNING *
    `);
    res.status(201).json(unit);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* PATCH update unit */
router.patch("/org-units/:id", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const tid = tenantIdOf(req);
    if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { name, type, parentId, managerId, managerName, description, status } = req.body as any;
    const existing = await sqlOne(sql`SELECT id FROM organization_units WHERE id = ${parseInt(String(req.params.id))} AND office_id = ${tid}`);
    if (!existing) return res.status(404).json({ error: "الوحدة غير موجودة" });

    const unit = await sqlOne(sql`
      UPDATE organization_units SET
        name         = COALESCE(${name ?? null}, name),
        type         = COALESCE(${type ?? null}, type),
        parent_id    = ${parentId !== undefined ? (parentId ?? null) : sql`parent_id`},
        manager_id   = COALESCE(${managerId ?? null}, manager_id),
        manager_name = COALESCE(${managerName ?? null}, manager_name),
        description  = COALESCE(${description ?? null}, description),
        status       = COALESCE(${status ?? null}, status),
        updated_at   = NOW()
      WHERE id = ${parseInt(String(req.params.id))} AND office_id = ${tid}
      RETURNING *
    `);
    res.json(unit);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* PATCH move unit (change parent) */
router.patch("/org-units/:id/move", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const tid = tenantIdOf(req);
    if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { parentId } = req.body as { parentId: number | null };
    if (parentId != null) {
      const parent = await sqlOne(sql`
        SELECT id FROM organization_units WHERE id = ${parentId} AND office_id = ${tid}
      `);
      if (!parent) return res.status(400).json({ error: "الوحدة الأب غير موجودة في هذا المكتب" });
    }
    const unit = await sqlOne(sql`
      UPDATE organization_units SET parent_id = ${parentId ?? null}, updated_at = NOW()
      WHERE id = ${parseInt(String(req.params.id))} AND office_id = ${tid} RETURNING *
    `);
    if (!unit) return res.status(404).json({ error: "الوحدة غير موجودة" });
    res.json(unit);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* PATCH toggle status */
router.patch("/org-units/:id/status", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const tid = tenantIdOf(req);
    if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { status } = req.body as { status: string };
    const unit = await sqlOne(sql`
      UPDATE organization_units SET status = ${status}, updated_at = NOW()
      WHERE id = ${parseInt(String(req.params.id))} AND office_id = ${tid} RETURNING *
    `);
    if (!unit) return res.status(404).json({ error: "الوحدة غير موجودة" });
    res.json(unit);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* DELETE unit */
router.delete("/org-units/:id", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const tid = tenantIdOf(req);
    if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const children = await sqlOne(sql`SELECT id FROM organization_units WHERE parent_id = ${parseInt(String(req.params.id))} AND office_id = ${tid} LIMIT 1`);
    if (children) return res.status(400).json({ error: "لا يمكن حذف وحدة تحتوي على وحدات فرعية" });

    await db.execute(sql`DELETE FROM organization_units WHERE id = ${parseInt(String(req.params.id))} AND office_id = ${tid}`);
    res.status(204).end();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET users list (for manager selection) */
router.get("/org-units-users", requireAuthWithTenant, async (req, res) => {
  const tid = tenantIdOf(req);
  if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
  try {
    const users = await sqlAll(sql`
      SELECT id, full_name, email, role FROM users
      WHERE office_id = ${tid}
      ORDER BY full_name LIMIT 100
    `);
    res.json(users);
  } catch { res.json([]); }
});

export default router;
