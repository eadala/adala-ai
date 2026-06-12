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

/* ══════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════ */

/* GET all units */
router.get("/org-units", async (_req, res) => {
  await ensureTables();
  try {
    const units = await sqlAll(sql`
      SELECT * FROM organization_units ORDER BY created_at ASC
    `);
    res.json(units);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET single unit */
router.get("/org-units/:id", async (req, res) => {
  await ensureTables();
  try {
    const unit = await sqlOne(sql`SELECT * FROM organization_units WHERE id = ${parseInt(req.params.id)}`);
    if (!unit) return res.status(404).json({ error: "الوحدة غير موجودة" });
    res.json(unit);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET unit stats */
router.get("/org-units/:id/stats", async (req, res) => {
  await ensureTables();
  const id = parseInt(req.params.id);
  try {
    const [cases, clients, contracts, invoicesAgg] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*)::int as count FROM cases WHERE organization_unit_id = ${id} AND status != 'deleted'`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM clients WHERE organization_unit_id = ${id}`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM contracts WHERE organization_unit_id = ${id}`),
      sqlOne(sql`SELECT COUNT(*)::int as count, COALESCE(SUM(CASE WHEN status='paid' THEN total_amount ELSE 0 END),0) as revenue FROM client_invoices WHERE organization_unit_id = ${id}`),
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
router.get("/org-units-dashboard", async (_req, res) => {
  await ensureTables();
  try {
    const [total, active, byType, topUnits] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*)::int as count FROM organization_units`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM organization_units WHERE status = 'active'`),
      sqlAll(sql`SELECT type, COUNT(*)::int as count FROM organization_units GROUP BY type ORDER BY count DESC`),
      sqlAll(sql`
        SELECT o.id, o.name, o.type, o.status,
          (SELECT COUNT(*)::int FROM cases c WHERE c.organization_unit_id = o.id) as cases_count,
          (SELECT COUNT(*)::int FROM clients cl WHERE cl.organization_unit_id = o.id) as clients_count
        FROM organization_units o
        WHERE o.status = 'active'
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
router.post("/org-units", async (req, res) => {
  await ensureTables();
  try {
    const { name, type, parentId, managerId, managerName, description } = req.body as {
      name: string; type: string; parentId?: number | null;
      managerId?: string; managerName?: string; description?: string;
    };
    if (!name) return res.status(400).json({ error: "اسم الوحدة مطلوب" });

    const unit = await sqlOne(sql`
      INSERT INTO organization_units (name, type, parent_id, manager_id, manager_name, description, status)
      VALUES (${name}, ${type ?? 'DEPARTMENT'}, ${parentId ?? null}, ${managerId ?? null}, ${managerName ?? null}, ${description ?? null}, 'active')
      RETURNING *
    `);
    res.status(201).json(unit);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* PATCH update unit */
router.patch("/org-units/:id", async (req, res) => {
  await ensureTables();
  try {
    const { name, type, parentId, managerId, managerName, description, status } = req.body as any;
    const existing = await sqlOne(sql`SELECT id FROM organization_units WHERE id = ${parseInt(req.params.id)}`);
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
      WHERE id = ${parseInt(req.params.id)}
      RETURNING *
    `);
    res.json(unit);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* PATCH move unit (change parent) */
router.patch("/org-units/:id/move", async (req, res) => {
  await ensureTables();
  try {
    const { parentId } = req.body as { parentId: number | null };
    const unit = await sqlOne(sql`
      UPDATE organization_units SET parent_id = ${parentId ?? null}, updated_at = NOW()
      WHERE id = ${parseInt(req.params.id)} RETURNING *
    `);
    if (!unit) return res.status(404).json({ error: "الوحدة غير موجودة" });
    res.json(unit);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* PATCH toggle status */
router.patch("/org-units/:id/status", async (req, res) => {
  await ensureTables();
  try {
    const { status } = req.body as { status: string };
    const unit = await sqlOne(sql`
      UPDATE organization_units SET status = ${status}, updated_at = NOW()
      WHERE id = ${parseInt(req.params.id)} RETURNING *
    `);
    if (!unit) return res.status(404).json({ error: "الوحدة غير موجودة" });
    res.json(unit);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* DELETE unit */
router.delete("/org-units/:id", async (req, res) => {
  await ensureTables();
  try {
    const children = await sqlOne(sql`SELECT id FROM organization_units WHERE parent_id = ${parseInt(req.params.id)} LIMIT 1`);
    if (children) return res.status(400).json({ error: "لا يمكن حذف وحدة تحتوي على وحدات فرعية" });

    await db.execute(sql`DELETE FROM organization_units WHERE id = ${parseInt(req.params.id)}`);
    res.status(204).end();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET users list (for manager selection) */
router.get("/org-units-users", async (_req, res) => {
  try {
    const users = await sqlAll(sql`SELECT id, full_name, email, role FROM users ORDER BY full_name LIMIT 100`);
    res.json(users);
  } catch { res.json([]); }
});

export default router;
