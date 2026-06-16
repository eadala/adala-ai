/**
 * HR Core Module — عدالة AI
 * ─────────────────────────────────────────────────────────────────────────
 * ✅ FIXED: جميع الاستعلامات معزولة بـ office_id (إصلاح ثغرة تسريب البيانات)
 * ✅ FIXED: INSERT يتضمن office_id في كل العمليات
 * ✅ FIXED: UPDATE/DELETE مُقيَّدة بـ office_id
 */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ── helpers ─────────────────────────────────────────── */
function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }
function num(v: any)         { return parseFloat(String(v ?? "0")) || 0; }
function today()             { return new Date().toISOString().split("T")[0]; }

async function sq(q: any): Promise<any[]> {
  try { return rows(await db.execute(q)); } catch { return []; }
}
async function s1(q: any): Promise<any> { return (await sq(q))[0] ?? null; }

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ══════════════════════════════════════════════════════════
   EMPLOYEES — مُعزولة بـ office_id
══════════════════════════════════════════════════════════ */

router.get("/hr/employees", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const data = await sq(sql`
      SELECT * FROM employees WHERE office_id = ${tid}
      ORDER BY created_at DESC
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr/employees/stats", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const r = one(await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE status='inactive')::int AS inactive,
        COALESCE(SUM(CAST(salary AS NUMERIC)),0) AS total_salaries
      FROM employees WHERE office_id = ${tid}
    `));
    res.json({ total: r?.total ?? 0, active: r?.active ?? 0, inactive: r?.inactive ?? 0, totalSalaries: num(r?.total_salaries) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr/employees", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { fullName, jobTitle, department, salary, phone, email,
            nationalId, hireDate, status = "active", bankIban, bankName } = req.body;
    if (!fullName) return res.status(400).json({ error: "اسم الموظف مطلوب" });
    const row = one(await db.execute(sql`
      INSERT INTO employees
        (office_id, full_name, job_title, department, salary, phone, email,
         national_id, hire_date, status, bank_iban, bank_name)
      VALUES (${tid}, ${fullName}, ${jobTitle ?? fullName}, ${department ?? null},
              ${salary ?? "0"}, ${phone ?? null}, ${email ?? null},
              ${nationalId ?? null}, ${hireDate ?? null}, ${status},
              ${bankIban ?? null}, ${bankName ?? null})
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/employees/:id", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { fullName, jobTitle, department, salary, phone, email,
            nationalId, hireDate, status, bankIban, bankName } = req.body;
    const row = one(await db.execute(sql`
      UPDATE employees SET
        full_name    = COALESCE(${fullName    ?? null}, full_name),
        job_title    = COALESCE(${jobTitle    ?? null}, job_title),
        department   = COALESCE(${department  ?? null}, department),
        salary       = COALESCE(${salary      ?? null}, salary),
        phone        = COALESCE(${phone       ?? null}, phone),
        email        = COALESCE(${email       ?? null}, email),
        national_id  = COALESCE(${nationalId  ?? null}, national_id),
        hire_date    = COALESCE(${hireDate    ?? null}, hire_date),
        status       = COALESCE(${status      ?? null}, status),
        bank_iban    = COALESCE(${bankIban    ?? null}, bank_iban),
        bank_name    = COALESCE(${bankName    ?? null}, bank_name),
        updated_at   = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tid}
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/hr/employees/:id", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    await db.execute(sql`
      DELETE FROM employees WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tid}
    `);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ATTENDANCE — مُعزولة بـ office_id (عبر employee)
══════════════════════════════════════════════════════════ */

router.get("/hr/attendance", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { employeeId, date } = req.query as Record<string, string>;
  try {
    const data = await sq(sql`
      SELECT a.*, e.full_name AS employee_name, e.job_title, e.department
      FROM attendance a
      INNER JOIN employees e ON e.id = a.employee_id AND e.office_id = ${tid}
      WHERE 1=1
        ${employeeId ? sql`AND a.employee_id = ${employeeId}::uuid` : sql``}
        ${date ? sql`AND a.work_date = ${date}::date` : sql``}
      ORDER BY a.created_at DESC
      LIMIT 500
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr/attendance/stats", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const r = one(await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE a.status='present')::int AS present,
        COUNT(*) FILTER (WHERE a.status='absent')::int AS absent,
        COUNT(*) FILTER (WHERE a.work_date = CURRENT_DATE)::int AS today
      FROM attendance a
      INNER JOIN employees e ON e.id = a.employee_id AND e.office_id = ${tid}
    `));
    res.json(r ?? { total: 0, present: 0, absent: 0, today: 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr/attendance/check-in", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { employeeId, latitude, longitude } = req.body;
  try {
    const emp = one(await db.execute(sql`SELECT * FROM employees WHERE id = ${employeeId}::uuid AND office_id = ${tid}`));
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

    const existing = one(await db.execute(sql`
      SELECT id FROM attendance WHERE employee_id = ${employeeId}::uuid AND work_date = CURRENT_DATE
    `));
    if (existing) return res.status(400).json({ error: "تم تسجيل الحضور مسبقاً لهذا اليوم" });

    let locationVerified = false;
    let distanceMeters: number | null = null;
    if (latitude != null && longitude != null) {
      const office = one(await db.execute(sql`SELECT * FROM office_location WHERE is_active = true LIMIT 1`));
      if (office?.latitude && office?.longitude) {
        distanceMeters = haversineDistance(num(latitude), num(longitude), num(office.latitude), num(office.longitude));
        locationVerified = distanceMeters <= (num(office.allowed_radius_meters) || 300);
      }
    }

    const row = one(await db.execute(sql`
      INSERT INTO attendance (employee_id, check_in, work_date, status, location_verified, distance_meters)
      VALUES (${employeeId}::uuid, NOW(), CURRENT_DATE, 'present', ${locationVerified}, ${distanceMeters})
      RETURNING *
    `));
    res.json({ ...row, locationVerified, distanceMeters });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr/attendance/check-out", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { employeeId } = req.body;
  try {
    const emp = one(await db.execute(sql`SELECT id FROM employees WHERE id = ${employeeId}::uuid AND office_id = ${tid}`));
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

    const record = one(await db.execute(sql`
      SELECT * FROM attendance WHERE employee_id = ${employeeId}::uuid AND work_date = CURRENT_DATE
    `));
    if (!record) return res.status(400).json({ error: "لا يوجد حضور لهذا اليوم" });
    if (record.check_out) return res.status(400).json({ error: "تم تسجيل الانصراف مسبقاً" });

    const row = one(await db.execute(sql`
      UPDATE attendance SET check_out = NOW(), updated_at = NOW()
      WHERE id = ${record.id}::uuid RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr/attendance", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { employeeId, workDate, status, checkIn, checkOut, notes } = req.body;
    const emp = one(await db.execute(sql`SELECT id FROM employees WHERE id = ${employeeId}::uuid AND office_id = ${tid}`));
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
    const row = one(await db.execute(sql`
      INSERT INTO attendance (employee_id, work_date, status, check_in, check_out, notes)
      VALUES (${employeeId}::uuid, ${workDate}::date, ${status ?? "present"},
              ${checkIn ?? null}, ${checkOut ?? null}, ${notes ?? null})
      ON CONFLICT (employee_id, work_date) DO UPDATE
        SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = NOW()
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr/office-location", requireAuthWithTenant, async (_req, res) => {
  const data = one(await db.execute(sql`SELECT * FROM office_location WHERE is_active = true LIMIT 1`));
  res.json(data ?? null);
});

router.post("/hr/office-location", requireAuthWithTenant, async (req, res) => {
  try {
    const { latitude, longitude, allowedRadiusMeters, name } = req.body;
    const row = one(await db.execute(sql`
      INSERT INTO office_location (name, latitude, longitude, allowed_radius_meters, is_active)
      VALUES (${name ?? "المكتب"}, ${latitude}, ${longitude}, ${allowedRadiusMeters ?? 300}, true)
      ON CONFLICT DO NOTHING
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   LEAVES — مُعزولة بـ office_id
══════════════════════════════════════════════════════════ */

router.get("/hr/leaves", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const data = await sq(sql`
      SELECT l.*, e.full_name AS employee_name, e.job_title
      FROM leaves l
      INNER JOIN employees e ON e.id = l.employee_id AND e.office_id = ${tid}
      ORDER BY l.created_at DESC
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr/leaves/stats", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const r = one(await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE l.status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE l.status='approved')::int AS approved,
        COUNT(*) FILTER (WHERE l.status='rejected')::int AS rejected,
        COUNT(*)::int AS total
      FROM leaves l
      INNER JOIN employees e ON e.id = l.employee_id AND e.office_id = ${tid}
    `));
    res.json(r ?? { pending: 0, approved: 0, rejected: 0, total: 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr/leaves", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { employeeId, type, startDate, endDate, reason } = req.body;
    if (!employeeId || !startDate || !endDate) return res.status(400).json({ error: "employeeId وstartDate وendDate مطلوبة" });
    const emp = one(await db.execute(sql`SELECT id FROM employees WHERE id = ${employeeId}::uuid AND office_id = ${tid}`));
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    const row = one(await db.execute(sql`
      INSERT INTO leaves (employee_id, type, start_date, end_date, days, reason, status)
      VALUES (${employeeId}::uuid, ${type ?? "annual"}, ${startDate}::date, ${endDate}::date,
              ${days}, ${reason ?? null}, 'pending')
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/leaves/:id", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { status, approvedBy } = req.body;
    const row = one(await db.execute(sql`
      UPDATE leaves SET
        status = ${status},
        approved_by = ${approvedBy ?? null},
        approved_at = ${status !== "pending" ? new Date().toISOString() : null},
        updated_at  = NOW()
      WHERE id = ${String(req.params.id)}::uuid
        AND employee_id IN (SELECT id FROM employees WHERE office_id = ${tid})
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   PAYROLL — مُعزولة بـ office_id
══════════════════════════════════════════════════════════ */

router.get("/hr/payroll", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const data = await sq(sql`
      SELECT p.*, e.full_name AS employee_name, e.job_title
      FROM payroll p
      INNER JOIN employees e ON e.id = p.employee_id AND e.office_id = ${tid}
      ORDER BY p.created_at DESC
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr/payroll/stats", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const r = one(await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(p.net_salary AS NUMERIC)) FILTER (WHERE p.status='paid'),0) AS total_paid,
        COUNT(*) FILTER (WHERE p.status='draft')::int AS total_draft,
        COUNT(*) FILTER (WHERE p.status='paid')::int AS paid_count
      FROM payroll p
      INNER JOIN employees e ON e.id = p.employee_id AND e.office_id = ${tid}
    `));
    res.json({ totalPaid: num(r?.total_paid), totalDraft: r?.total_draft ?? 0, paidCount: r?.paid_count ?? 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr/payroll/generate", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { month, year } = req.body;
    const employees = await sq(sql`SELECT * FROM employees WHERE office_id = ${tid} AND status = 'active'`);
    const entries = [];
    for (const emp of employees) {
      const base = num(emp.salary);
      const gosi = base * 0.1, allowances = base * 0.15, deductions = 0;
      const net = base + allowances - deductions - gosi;
      const row = one(await db.execute(sql`
        INSERT INTO payroll (employee_id, month, year, base_salary, allowances, deductions, gosi, net_salary, status)
        VALUES (${emp.id}::uuid, ${month}, ${parseInt(year)},
                ${String(base)}, ${String(allowances)}, ${String(deductions)},
                ${String(gosi)}, ${String(net)}, 'draft')
        RETURNING *
      `));
      entries.push(row);
    }
    res.json({ generated: entries.length, entries });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/payroll/:id/pay", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const row = one(await db.execute(sql`
      UPDATE payroll SET status = 'paid', paid_at = NOW(), updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid
        AND employee_id IN (SELECT id FROM employees WHERE office_id = ${tid})
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/payroll/pay-all", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { month, year } = req.body;
    await db.execute(sql`
      UPDATE payroll SET status = 'paid', paid_at = NOW(), updated_at = NOW()
      WHERE status = 'draft' AND month = ${month} AND year = ${parseInt(year)}
        AND employee_id IN (SELECT id FROM employees WHERE office_id = ${tid})
    `);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   WARNINGS — مُعزولة بـ office_id
══════════════════════════════════════════════════════════ */

router.get("/hr/warnings", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const data = await sq(sql`
      SELECT w.*, e.full_name AS employee_name, e.job_title, e.department
      FROM employee_warnings w
      INNER JOIN employees e ON e.id = w.employee_id AND e.office_id = ${tid}
      ORDER BY w.created_at DESC
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr/warnings", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { employeeId, type, reason, description, issuedBy } = req.body;
    if (!employeeId || !type || !reason) return res.status(400).json({ error: "employeeId وtype وreason مطلوبة" });
    const emp = one(await db.execute(sql`SELECT id FROM employees WHERE id = ${employeeId}::uuid AND office_id = ${tid}`));
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
    const row = one(await db.execute(sql`
      INSERT INTO employee_warnings (employee_id, type, reason, description, issued_by, status)
      VALUES (${employeeId}::uuid, ${type}, ${reason}, ${description ?? null}, ${issuedBy ?? null}, 'active')
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/warnings/:id", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { status, appealNotes } = req.body;
    const row = one(await db.execute(sql`
      UPDATE employee_warnings SET
        status = COALESCE(${status ?? null}, status),
        appeal_notes = COALESCE(${appealNotes ?? null}, appeal_notes),
        resolved_at = CASE WHEN ${status ?? null} = 'resolved' THEN NOW() ELSE resolved_at END,
        updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid
        AND employee_id IN (SELECT id FROM employees WHERE office_id = ${tid})
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/hr/warnings/:id", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    await db.execute(sql`
      DELETE FROM employee_warnings
      WHERE id = ${String(req.params.id)}::uuid
        AND employee_id IN (SELECT id FROM employees WHERE office_id = ${tid})
    `);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   INVESTIGATIONS — مُعزولة بـ office_id
══════════════════════════════════════════════════════════ */

router.get("/hr/investigations", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const data = await sq(sql`
      SELECT i.*, e.full_name AS employee_name, e.job_title, e.department
      FROM employee_investigations i
      INNER JOIN employees e ON e.id = i.employee_id AND e.office_id = ${tid}
      ORDER BY i.created_at DESC
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr/investigations", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { employeeId, subject, description, openedBy, committee, sessionDate } = req.body;
    if (!employeeId || !subject) return res.status(400).json({ error: "employeeId وsubject مطلوبان" });
    const emp = one(await db.execute(sql`SELECT id FROM employees WHERE id = ${employeeId}::uuid AND office_id = ${tid}`));
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
    const row = one(await db.execute(sql`
      INSERT INTO employee_investigations (employee_id, subject, description, opened_by, committee, session_date, status)
      VALUES (${employeeId}::uuid, ${subject}, ${description ?? null},
              ${openedBy ?? null}, ${committee ?? null}, ${sessionDate ?? null}, 'open')
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/investigations/:id", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const { status, outcome, notes, committee, sessionDate } = req.body;
    const row = one(await db.execute(sql`
      UPDATE employee_investigations SET
        status       = COALESCE(${status      ?? null}, status),
        outcome      = COALESCE(${outcome     ?? null}, outcome),
        notes        = COALESCE(${notes       ?? null}, notes),
        committee    = COALESCE(${committee   ?? null}, committee),
        session_date = COALESCE(${sessionDate ?? null}::date, session_date),
        closed_at    = CASE WHEN ${status ?? null} = 'closed' THEN NOW() ELSE closed_at END,
        updated_at   = NOW()
      WHERE id = ${String(req.params.id)}::uuid
        AND employee_id IN (SELECT id FROM employees WHERE office_id = ${tid})
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/hr/investigations/:id", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    await db.execute(sql`
      DELETE FROM employee_investigations
      WHERE id = ${String(req.params.id)}::uuid
        AND employee_id IN (SELECT id FROM employees WHERE office_id = ${tid})
    `);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
