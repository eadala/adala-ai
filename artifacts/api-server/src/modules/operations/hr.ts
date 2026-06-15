import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, attendanceTable, leavesTable, payrollTable, officeLocationTable, employeeWarningsTable, employeeInvestigationsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const router = Router();

/* ─── EMPLOYEES ─────────────────────────────────────── */

router.get("/hr/employees", requireAuthWithTenant, async (_req, res) => {
  const rows = await db.select().from(employeesTable).orderBy(desc(employeesTable.createdAt));
  res.json(rows);
});

router.post("/hr/employees", requireAuthWithTenant, async (req, res) => {
  try {
    const { fullName, jobTitle, department, salary, phone, email,
            nationalId, hireDate, status = "active", bankIban, bankName } = req.body;
    if (!fullName) return res.status(400).json({ error: "اسم الموظف مطلوب" });
    const [row] = await db.insert(employeesTable).values({
      fullName, jobTitle: jobTitle ?? fullName, department: department ?? null,
      salary: salary ?? "0", phone: phone ?? null, email: email ?? null,
      nationalId: nationalId ?? null, hireDate: hireDate ? String(hireDate) : null,
      status, bankIban: bankIban ?? null, bankName: bankName ?? null,
    } as any).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/employees/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const { fullName, jobTitle, department, salary, phone, email,
            nationalId, hireDate, status, bankIban, bankName } = req.body;
    const [row] = await db.update(employeesTable)
      .set({
        ...(fullName   !== undefined && { fullName }),
        ...(jobTitle   !== undefined && { jobTitle }),
        ...(department !== undefined && { department }),
        ...(salary     !== undefined && { salary: String(salary) }),
        ...(phone      !== undefined && { phone }),
        ...(email      !== undefined && { email }),
        ...(nationalId !== undefined && { nationalId }),
        ...(hireDate   !== undefined && { hireDate }),
        ...(status     !== undefined && { status }),
        ...(bankIban   !== undefined && { bankIban }),
        ...(bankName   !== undefined && { bankName }),
        updatedAt: new Date(),
      })
      .where(eq(employeesTable.id, String(req.params.id))).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/hr/employees/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await db.delete(employeesTable).where(eq(employeesTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr/employees/stats", requireAuthWithTenant, async (_req, res) => {
  const all = await db.select().from(employeesTable);
  res.json({
    total: all.length,
    active: all.filter(e => e.status === "active").length,
    inactive: all.filter(e => e.status === "inactive").length,
    totalSalaries: all.reduce((s, e) => s + parseFloat(String(e.salary) || "0"), 0),
  });
});

/* ─── ATTENDANCE ─────────────────────────────────────── */

router.get("/hr/attendance", requireAuthWithTenant, async (req, res) => {
  const { employeeId, date } = req.query as Record<string, string>;
  let q = db.select({
    id: attendanceTable.id,
    employeeId: attendanceTable.employeeId,
    checkIn: attendanceTable.checkIn,
    checkOut: attendanceTable.checkOut,
    workDate: attendanceTable.workDate,
    status: attendanceTable.status,
    notes: attendanceTable.notes,
    createdAt: attendanceTable.createdAt,
    employeeName: employeesTable.fullName,
    jobTitle: employeesTable.jobTitle,
    department: employeesTable.department,
  }).from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .orderBy(desc(attendanceTable.createdAt));
  const rows = await q;
  const filtered = rows.filter(r => {
    if (employeeId && r.employeeId !== employeeId) return false;
    if (date && r.workDate !== date) return false;
    return true;
  });
  res.json(filtered);
});

router.post("/hr/attendance/check-in", requireAuthWithTenant, async (req, res) => {
  const { employeeId, latitude, longitude } = req.body;
  const today = new Date().toISOString().split("T")[0];
  const existing = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.workDate, today)));
  if (existing.length > 0) return res.status(400).json({ error: "تم تسجيل الحضور مسبقاً لهذا اليوم" });

  let locationVerified = false;
  let distanceMeters: number | null = null;
  if (latitude != null && longitude != null) {
    const [office] = await db.select().from(officeLocationTable).where(eq(officeLocationTable.isActive, true));
    if (office) {
      distanceMeters = Math.round(haversineDistance(latitude, longitude, parseFloat(String(office.latitude)), parseFloat(String(office.longitude))));
      locationVerified = distanceMeters <= office.radius;
    }
  }

  const [row] = await db.insert(attendanceTable).values({
    employeeId, workDate: today, checkIn: new Date(), status: "present",
    ipAddress: req.ip,
    checkInLat: latitude != null ? String(latitude) : null,
    checkInLng: longitude != null ? String(longitude) : null,
    locationVerified,
  }).returning();
  res.json({ ...row, distanceMeters });
});

router.post("/hr/attendance/check-out", requireAuthWithTenant, async (req, res) => {
  const { employeeId, latitude, longitude } = req.body;
  const today = new Date().toISOString().split("T")[0];
  const [existing] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.workDate, today)));
  if (!existing) return res.status(404).json({ error: "لم يتم تسجيل الحضور بعد" });
  const [row] = await db.update(attendanceTable)
    .set({
      checkOut: new Date(),
      checkOutLat: latitude != null ? String(latitude) : null,
      checkOutLng: longitude != null ? String(longitude) : null,
    })
    .where(eq(attendanceTable.id, existing.id)).returning();
  res.json(row);
});

/* ─── OFFICE LOCATION ─────────────────────────────────────── */

router.get("/hr/office-location", requireAuthWithTenant, async (_req, res) => {
  const [office] = await db.select().from(officeLocationTable).where(eq(officeLocationTable.isActive, true));
  res.json(office ?? null);
});

router.post("/hr/office-location", requireAuthWithTenant, async (req, res) => {
  const { name, latitude, longitude, radius } = req.body;
  await db.update(officeLocationTable).set({ isActive: false });
  const [row] = await db.insert(officeLocationTable).values({
    name: name || "المكتب الرئيسي",
    latitude: String(latitude),
    longitude: String(longitude),
    radius: parseInt(radius) || 200,
    isActive: true,
  }).returning();
  res.json(row);
});

router.post("/hr/attendance", requireAuthWithTenant, async (req, res) => {
  try {
    const { employeeId, workDate, checkIn, checkOut, status, notes } = req.body;
    if (!employeeId) return res.status(400).json({ error: "employeeId مطلوب" });
    const [row] = await db.insert(attendanceTable).values({
      employeeId, workDate: workDate ?? new Date().toISOString().split("T")[0],
      checkIn:  checkIn  ? new Date(checkIn)  : new Date(),
      checkOut: checkOut ? new Date(checkOut) : null,
      status: status ?? "present", notes: notes ?? null,
    }).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr/attendance/stats", requireAuthWithTenant, async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const all = await db.select().from(attendanceTable);
  const todayRows = all.filter(r => r.workDate === today);
  res.json({
    todayPresent: todayRows.filter(r => r.status === "present").length,
    todayAbsent: todayRows.filter(r => r.status === "absent").length,
    totalRecords: all.length,
    checkedOut: todayRows.filter(r => r.checkOut).length,
  });
});

/* ─── LEAVES ─────────────────────────────────────── */

router.get("/hr/leaves", requireAuthWithTenant, async (_req, res) => {
  const rows = await db.select({
    id: leavesTable.id,
    employeeId: leavesTable.employeeId,
    type: leavesTable.type,
    startDate: leavesTable.startDate,
    endDate: leavesTable.endDate,
    days: leavesTable.days,
    reason: leavesTable.reason,
    status: leavesTable.status,
    approvedBy: leavesTable.approvedBy,
    approvedAt: leavesTable.approvedAt,
    createdAt: leavesTable.createdAt,
    employeeName: employeesTable.fullName,
    jobTitle: employeesTable.jobTitle,
  }).from(leavesTable)
    .leftJoin(employeesTable, eq(leavesTable.employeeId, employeesTable.id))
    .orderBy(desc(leavesTable.createdAt));
  res.json(rows);
});

router.post("/hr/leaves", requireAuthWithTenant, async (req, res) => {
  try {
    const { employeeId, type, startDate, endDate, reason } = req.body;
    if (!employeeId || !startDate || !endDate) return res.status(400).json({ error: "employeeId وstartDate وendDate مطلوبة" });
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    const [row] = await db.insert(leavesTable).values({
      employeeId, type: type ?? "annual", startDate, endDate,
      days, reason: reason ?? null, status: "pending",
    }).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/leaves/:id", requireAuthWithTenant, async (req, res) => {
  const { status, approvedBy } = req.body;
  const [row] = await db.update(leavesTable)
    .set({ status, approvedBy, approvedAt: status !== "pending" ? new Date() : undefined })
    .where(eq(leavesTable.id, String(req.params.id))).returning();
  res.json(row);
});

router.get("/hr/leaves/stats", requireAuthWithTenant, async (_req, res) => {
  const all = await db.select().from(leavesTable);
  res.json({
    pending: all.filter(l => l.status === "pending").length,
    approved: all.filter(l => l.status === "approved").length,
    rejected: all.filter(l => l.status === "rejected").length,
    total: all.length,
  });
});

/* ─── PAYROLL ─────────────────────────────────────── */

router.get("/hr/payroll", requireAuthWithTenant, async (_req, res) => {
  const rows = await db.select({
    id: payrollTable.id,
    employeeId: payrollTable.employeeId,
    month: payrollTable.month,
    year: payrollTable.year,
    baseSalary: payrollTable.baseSalary,
    allowances: payrollTable.allowances,
    deductions: payrollTable.deductions,
    gosi: payrollTable.gosi,
    netSalary: payrollTable.netSalary,
    status: payrollTable.status,
    paidAt: payrollTable.paidAt,
    notes: payrollTable.notes,
    createdAt: payrollTable.createdAt,
    employeeName: employeesTable.fullName,
    jobTitle: employeesTable.jobTitle,
  }).from(payrollTable)
    .leftJoin(employeesTable, eq(payrollTable.employeeId, employeesTable.id))
    .orderBy(desc(payrollTable.createdAt));
  res.json(rows);
});

router.post("/hr/payroll/generate", requireAuthWithTenant, async (req, res) => {
  const { month, year } = req.body;
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.status, "active"));
  const entries = [];
  for (const emp of employees) {
    const base = parseFloat(String(emp.salary) || "0");
    const gosi = base * 0.1;
    const allowances = base * 0.15;
    const deductions = 0;
    const net = base + allowances - deductions - gosi;
    const [row] = await db.insert(payrollTable).values({
      employeeId: emp.id, month, year: parseInt(year),
      baseSalary: String(base), allowances: String(allowances),
      deductions: String(deductions), gosi: String(gosi),
      netSalary: String(net), status: "draft",
    }).returning();
    entries.push(row);
  }
  res.json({ generated: entries.length, entries });
});

router.patch("/hr/payroll/:id/pay", requireAuthWithTenant, async (req, res) => {
  const [row] = await db.update(payrollTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(payrollTable.id, String(req.params.id))).returning();
  res.json(row);
});

router.patch("/hr/payroll/pay-all", requireAuthWithTenant, async (req, res) => {
  const { month, year } = req.body;
  await db.update(payrollTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(payrollTable.month, month), eq(payrollTable.status, "draft")));
  res.json({ success: true });
});

/* ─── WARNINGS ─────────────────────────────────────── */

router.get("/hr/warnings", requireAuthWithTenant, async (_req, res) => {
  const rows = await db.select({
    id: employeeWarningsTable.id,
    employeeId: employeeWarningsTable.employeeId,
    type: employeeWarningsTable.type,
    reason: employeeWarningsTable.reason,
    description: employeeWarningsTable.description,
    issuedBy: employeeWarningsTable.issuedBy,
    status: employeeWarningsTable.status,
    appealNotes: employeeWarningsTable.appealNotes,
    resolvedAt: employeeWarningsTable.resolvedAt,
    createdAt: employeeWarningsTable.createdAt,
    employeeName: employeesTable.fullName,
    jobTitle: employeesTable.jobTitle,
    department: employeesTable.department,
  }).from(employeeWarningsTable)
    .leftJoin(employeesTable, eq(employeeWarningsTable.employeeId, employeesTable.id))
    .orderBy(desc(employeeWarningsTable.createdAt));
  res.json(rows);
});

router.post("/hr/warnings", requireAuthWithTenant, async (req, res) => {
  try {
    const { employeeId, type, reason, description, issuedBy } = req.body;
    if (!employeeId || !type || !reason) return res.status(400).json({ error: "employeeId وtype وreason مطلوبة" });
    const [row] = await db.insert(employeeWarningsTable).values({
      employeeId, type, reason, description: description ?? null,
      issuedBy: issuedBy ?? null, status: "active",
    }).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/warnings/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const { status, appealNotes } = req.body;
    const updates: any = {};
    if (status      !== undefined) updates.status      = status;
    if (appealNotes !== undefined) updates.appealNotes = appealNotes;
    if (status === "resolved") updates.resolvedAt = new Date();
    const [row] = await db.update(employeeWarningsTable).set(updates)
      .where(eq(employeeWarningsTable.id, String(req.params.id))).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/hr/warnings/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await db.delete(employeeWarningsTable).where(eq(employeeWarningsTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─── INVESTIGATIONS ─────────────────────────────────────── */

router.get("/hr/investigations", requireAuthWithTenant, async (_req, res) => {
  const rows = await db.select({
    id: employeeInvestigationsTable.id,
    employeeId: employeeInvestigationsTable.employeeId,
    subject: employeeInvestigationsTable.subject,
    description: employeeInvestigationsTable.description,
    status: employeeInvestigationsTable.status,
    outcome: employeeInvestigationsTable.outcome,
    openedBy: employeeInvestigationsTable.openedBy,
    committee: employeeInvestigationsTable.committee,
    sessionDate: employeeInvestigationsTable.sessionDate,
    closedAt: employeeInvestigationsTable.closedAt,
    notes: employeeInvestigationsTable.notes,
    createdAt: employeeInvestigationsTable.createdAt,
    updatedAt: employeeInvestigationsTable.updatedAt,
    employeeName: employeesTable.fullName,
    jobTitle: employeesTable.jobTitle,
    department: employeesTable.department,
  }).from(employeeInvestigationsTable)
    .leftJoin(employeesTable, eq(employeeInvestigationsTable.employeeId, employeesTable.id))
    .orderBy(desc(employeeInvestigationsTable.createdAt));
  res.json(rows);
});

router.post("/hr/investigations", requireAuthWithTenant, async (req, res) => {
  try {
    const { employeeId, subject, description, openedBy, committee, sessionDate } = req.body;
    if (!employeeId || !subject) return res.status(400).json({ error: "employeeId وsubject مطلوبان" });
    const [row] = await db.insert(employeeInvestigationsTable).values({
      employeeId, subject, description: description ?? null,
      openedBy: openedBy ?? null, committee: committee ?? null,
      sessionDate: sessionDate ?? null, status: "open",
    }).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/hr/investigations/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const { status, outcome, notes, committee, sessionDate } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (status      !== undefined) updates.status      = status;
    if (outcome     !== undefined) updates.outcome     = outcome;
    if (notes       !== undefined) updates.notes       = notes;
    if (committee   !== undefined) updates.committee   = committee;
    if (sessionDate !== undefined) updates.sessionDate = sessionDate;
    if (status === "closed") updates.closedAt = new Date();
    const [row] = await db.update(employeeInvestigationsTable).set(updates)
      .where(eq(employeeInvestigationsTable.id, String(req.params.id))).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/hr/investigations/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await db.delete(employeeInvestigationsTable)
      .where(eq(employeeInvestigationsTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr/payroll/stats", requireAuthWithTenant, async (_req, res) => {
  const all = await db.select().from(payrollTable);
  res.json({
    totalPaid: all.filter(p => p.status === "paid").reduce((s, p) => s + parseFloat(String(p.netSalary) || "0"), 0),
    totalDraft: all.filter(p => p.status === "draft").length,
    paidCount: all.filter(p => p.status === "paid").length,
  });
});

export default router;
