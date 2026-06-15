import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hr_announcements (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      priority    TEXT NOT NULL DEFAULT 'normal',
      target_dept TEXT,
      author_name TEXT,
      author_id   TEXT,
      expires_at  DATE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_requests (
      id           SERIAL PRIMARY KEY,
      employee_id  TEXT NOT NULL,
      type         TEXT NOT NULL DEFAULT 'document',
      subject      TEXT NOT NULL,
      body         TEXT,
      status       TEXT NOT NULL DEFAULT 'pending',
      response     TEXT,
      resolved_by  TEXT,
      resolved_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS leave_balances (
      id          SERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      leave_type  TEXT NOT NULL DEFAULT 'annual',
      year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::int,
      quota       INTEGER NOT NULL DEFAULT 21,
      used        INTEGER NOT NULL DEFAULT 0,
      UNIQUE(employee_id, leave_type, year)
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
  return (await sqlAll(q))[0] ?? null;
}

/* ══════════════════════════════════════════════
   ANNOUNCEMENTS
══════════════════════════════════════════════ */
router.get("/hr-internal/announcements", requireAuthWithTenant, async (_req, res) => {
  await ensureTables();
  try {
    const rows = await sqlAll(sql`
      SELECT * FROM hr_announcements
      WHERE expires_at IS NULL OR expires_at >= CURRENT_DATE
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr-internal/announcements/all", requireAuthWithTenant, async (_req, res) => {
  await ensureTables();
  try {
    const rows = await sqlAll(sql`SELECT * FROM hr_announcements ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr-internal/announcements", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const { title, content, priority, targetDept, authorName, authorId, expiresAt } = req.body as any;
    if (!title || !content) return res.status(400).json({ error: "العنوان والمحتوى مطلوبان" });
    const row = await sqlOne(sql`
      INSERT INTO hr_announcements (title, content, priority, target_dept, author_name, author_id, expires_at)
      VALUES (${title}, ${content}, ${priority ?? 'normal'}, ${targetDept ?? null}, ${authorName ?? null}, ${authorId ?? null}, ${expiresAt ?? null})
      RETURNING *
    `);
    res.status(201).json(row);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/hr-internal/announcements/:id", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  await db.execute(sql`DELETE FROM hr_announcements WHERE id = ${parseInt(String(req.params.id))}`);
  res.status(204).end();
});

/* ══════════════════════════════════════════════
   EMPLOYEE REQUESTS
══════════════════════════════════════════════ */
router.get("/hr-internal/requests", requireAuthWithTenant, async (_req, res) => {
  await ensureTables();
  try {
    const rows = await sqlAll(sql`
      SELECT er.*, e.full_name as employee_name, e.job_title, e.department
      FROM employee_requests er
      LEFT JOIN employees e ON er.employee_id = e.id::text
      ORDER BY er.created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr-internal/requests", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const { employeeId, type, subject, body } = req.body as any;
    if (!employeeId || !subject) return res.status(400).json({ error: "الموظف والموضوع مطلوبان" });
    const row = await sqlOne(sql`
      INSERT INTO employee_requests (employee_id, type, subject, body)
      VALUES (${employeeId}, ${type ?? 'document'}, ${subject}, ${body ?? null})
      RETURNING *
    `);
    res.status(201).json(row);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch("/hr-internal/requests/:id", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const { status, response, resolvedBy } = req.body as any;
    const row = await sqlOne(sql`
      UPDATE employee_requests SET
        status = COALESCE(${status ?? null}, status),
        response = COALESCE(${response ?? null}, response),
        resolved_by = COALESCE(${resolvedBy ?? null}, resolved_by),
        resolved_at = CASE WHEN ${status ?? null} IS NOT NULL AND ${status ?? null} != 'pending' THEN NOW() ELSE resolved_at END
      WHERE id = ${parseInt(String(req.params.id))}
      RETURNING *
    `);
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json(row);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/hr-internal/requests/:id", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  await db.execute(sql`DELETE FROM employee_requests WHERE id = ${parseInt(String(req.params.id))}`);
  res.status(204).end();
});

/* ══════════════════════════════════════════════
   LEAVE BALANCES
══════════════════════════════════════════════ */
router.get("/hr-internal/leave-balances", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const year = parseInt(String(req.query.year ?? new Date().getFullYear()));
    /* get all active employees with their balances (auto-init to 21 days annual) */
    const employees = await sqlAll(sql`SELECT * FROM employees WHERE status = 'active' ORDER BY full_name`);
    const results = [];

    for (const emp of employees) {
      /* ensure balance rows exist */
      for (const type of ['annual', 'sick', 'emergency']) {
        const quota = type === 'annual' ? 21 : type === 'sick' ? 14 : 3;
        await db.execute(sql`
          INSERT INTO leave_balances (employee_id, leave_type, year, quota, used)
          VALUES (${emp.id}::text, ${type}, ${year}, ${quota}, 0)
          ON CONFLICT (employee_id, leave_type, year) DO NOTHING
        `);
        /* sync used from approved leaves */
        const used = await sqlOne(sql`
          SELECT COALESCE(SUM(days), 0)::int as total
          FROM leaves
          WHERE employee_id = ${emp.id}::text
            AND type = ${type}
            AND status = 'approved'
            AND EXTRACT(YEAR FROM start_date::date) = ${year}
        `);
        await db.execute(sql`
          UPDATE leave_balances SET used = ${used?.total ?? 0}
          WHERE employee_id = ${emp.id}::text AND leave_type = ${type} AND year = ${year}
        `);
      }

      const balances = await sqlAll(sql`
        SELECT * FROM leave_balances
        WHERE employee_id = ${emp.id}::text AND year = ${year}
      `);

      results.push({
        employeeId: String(emp.id),
        employeeName: emp.full_name,
        jobTitle: emp.job_title,
        department: emp.department,
        balances: balances.map((b: any) => ({
          type: b.leave_type, quota: b.quota, used: b.used,
          remaining: Math.max(0, b.quota - b.used),
        })),
      });
    }

    res.json(results);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr-internal/leave-balances/:employeeId", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const { leaveType, quota, year } = req.body as any;
    const y = year ?? new Date().getFullYear();
    await db.execute(sql`
      UPDATE leave_balances SET quota = ${parseInt(quota)}
      WHERE employee_id = ${String(req.params.employeeId)} AND leave_type = ${leaveType} AND year = ${y}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════
   PAYSLIP DATA
══════════════════════════════════════════════ */
router.get("/hr-internal/payslip/:payrollId", requireAuthWithTenant, async (req, res) => {
  try {
    const row = await sqlOne(sql`
      SELECT p.*, e.full_name, e.job_title, e.department, e.national_id, e.bank_iban, e.bank_name, e.hire_date
      FROM payroll p
      LEFT JOIN employees e ON p.employee_id = e.id::text
      WHERE p.id = ${parseInt(String(req.params.payrollId))}
    `);
    if (!row) return res.status(404).json({ error: "لم يُوجد كشف راتب" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════
   DASHBOARD STATS
══════════════════════════════════════════════ */
router.get("/hr-internal/dashboard", requireAuthWithTenant, async (_req, res) => {
  await ensureTables();
  try {
    const year = new Date().getFullYear();
    const [ann, pendingReqs, pendingLeaves, totalEmp] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*)::int as count FROM hr_announcements WHERE expires_at IS NULL OR expires_at >= CURRENT_DATE`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM employee_requests WHERE status = 'pending'`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM leaves WHERE status = 'pending'`),
      sqlOne(sql`SELECT COUNT(*)::int as count FROM employees WHERE status = 'active'`),
    ]);
    res.json({
      announcements: ann?.count ?? 0,
      pendingRequests: pendingReqs?.count ?? 0,
      pendingLeaves: pendingLeaves?.count ?? 0,
      totalEmployees: totalEmp?.count ?? 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
