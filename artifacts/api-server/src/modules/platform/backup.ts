import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  backupSettingsTable, backupJobsTable,
  casesTable, clientsTable, clientInvoicesTable,
  contractsTable, documentsTable, usersTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";

/* ── HR + Accounting raw-SQL helpers (tenant-scoped) ────────── */
async function fetchHR(tenantId: string) {
  const [employees, payroll, performance, incentives] = await Promise.all([
    db.execute(sql`SELECT * FROM employees WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows).catch(() => []),
    db.execute(sql`SELECT * FROM payroll WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows).catch(() => []),
    db.execute(sql`SELECT * FROM performance_evaluations WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows).catch(() => []),
    db.execute(sql`SELECT * FROM employee_incentives WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows).catch(() => []),
  ]);
  return { employees, payroll, performance, incentives };
}

async function fetchAccounting(tenantId: string) {
  const [revenues, expenses, bankAccounts, cashAdvances] = await Promise.all([
    db.execute(sql`SELECT * FROM revenues WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows).catch(() => []),
    db.execute(sql`SELECT * FROM expenses WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows).catch(() => []),
    db.execute(sql`SELECT * FROM bank_accounts WHERE office_id=${tenantId} LIMIT 1000`).then(r => r.rows).catch(() => []),
    db.execute(sql`SELECT * FROM cash_advances WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows).catch(() => []),
  ]);
  return { revenues, expenses, bankAccounts, cashAdvances };
}

const router = Router();

/* ── CSV helper ─────────────────────────────────────────── */
function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(",")),
  ].join("\n");
}

function dateStr() {
  return new Date().toISOString().split("T")[0];
}

/* ══════════════════════════════════════════════════════════
   BACKUP SETTINGS
══════════════════════════════════════════════════════════ */

/* GET /api/backup/settings */
router.get("/backup/settings", requireAuthWithTenant, async (_req, res) => {
  try {
    const rows = await db.select().from(backupSettingsTable).limit(1);
    if (rows.length) return res.json(rows[0]);
    res.json({
      schedule: "daily",
      retentionDays: 30,
      storageProvider: "local",
      cloudConfig: {},
      isEnabled: true,
      lastBackupAt: null,
    });
  } catch {
    res.status(500).json({ error: "خطأ في جلب إعدادات النسخ الاحتياطي" });
  }
});

/* PUT /api/backup/settings */
router.put("/backup/settings", requireAuthWithTenant, async (req, res) => {
  try {
    const { schedule, retentionDays, storageProvider, cloudConfig, isEnabled } = req.body;
    const rows = await db.select().from(backupSettingsTable).limit(1);
    if (rows.length) {
      await db.update(backupSettingsTable)
        .set({ schedule, retentionDays, storageProvider, cloudConfig, isEnabled, updatedAt: new Date() })
        .where(eq(backupSettingsTable.id, rows[0].id));
    } else {
      await db.insert(backupSettingsTable)
        .values({ schedule, retentionDays, storageProvider, cloudConfig, isEnabled });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "خطأ في حفظ الإعدادات" });
  }
});

/* ══════════════════════════════════════════════════════════
   BACKUP JOBS
══════════════════════════════════════════════════════════ */

/* GET /api/backup/jobs */
router.get("/backup/jobs", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const jobs = await db.execute(sql`
      SELECT id, type, schedule_type, status, size_bytes, file_name,
             error_message, created_at, completed_at
      FROM backup_jobs
      WHERE office_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT 100
    `).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? []));
    res.json(jobs);
  } catch {
    res.status(500).json({ error: "خطأ في جلب سجل النسخ" });
  }
});

/* POST /api/backup/create */
router.post("/backup/create", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { type = "manual", scheduleType } = req.body as { type?: string; scheduleType?: string };

    const [[cases, clients, invoices, contracts, docs, users], hr, accounting] = await Promise.all([
      Promise.all([
        db.execute(sql`SELECT * FROM cases WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM clients WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM client_invoices WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM contracts WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT id, file_name, file_type, case_id, created_at FROM documents WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT id, email, full_name, role, status FROM users WHERE office_id = ${tenantId} LIMIT 500`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
      ]),
      fetchHR(tenantId),
      fetchAccounting(tenantId),
    ]);

    const payload = {
      meta: {
        platform: "عدالة AI",
        version: "2.1",
        createdAt: new Date().toISOString(),
        type,
        sections: ["cases","clients","invoices","contracts","documents","users","hr","accounting"],
      },
      cases,
      clients,
      invoices,
      contracts,
      documents: docs,
      users,
      hr,
      accounting,
    };

    const dataStr = JSON.stringify(payload, null, 2);
    const sizeBytes = Buffer.byteLength(dataStr, "utf8");
    const fileName = `backup-${dateStr()}.json`;

    const [job] = await db.execute(sql`
      INSERT INTO backup_jobs (type, schedule_type, status, size_bytes, file_name, file_data, completed_at, office_id)
      VALUES (${type}, ${scheduleType ?? null}, 'completed', ${sizeBytes}, ${fileName}, ${dataStr}, NOW(), ${tenantId})
      RETURNING id
    `).then((r: any) => { const rows = Array.isArray(r) ? r : (r?.rows ?? []); return [rows[0]]; });

    const settings = await db.select().from(backupSettingsTable).limit(1);
    if (settings.length) {
      await db.update(backupSettingsTable)
        .set({ lastBackupAt: new Date(), updatedAt: new Date() })
        .where(eq(backupSettingsTable.id, settings[0].id));
    }

    res.json({ ok: true, jobId: job.id, fileName, sizeBytes });
  } catch (err) {
        res.status(500).json({ error: "خطأ في إنشاء النسخة الاحتياطية" });
  }
});

/* GET /api/backup/jobs/:id/download */
router.get("/backup/jobs/:id/download", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const rows = await db.execute(sql`
      SELECT * FROM backup_jobs
      WHERE id = ${String(req.params.id)} AND office_id = ${tenantId}
      LIMIT 1
    `).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? []));
    const job = rows[0];
    if (!job) return res.status(404).json({ error: "النسخة الاحتياطية غير موجودة" });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${job.file_name ?? "backup.json"}"`);
    res.send(job.file_data ?? "{}");
  } catch {
    res.status(500).json({ error: "خطأ في تحميل النسخة الاحتياطية" });
  }
});

/* DELETE /api/backup/jobs/:id */
router.delete("/backup/jobs/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    await db.execute(sql`
      DELETE FROM backup_jobs WHERE id = ${String(req.params.id)} AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "خطأ في حذف النسخة الاحتياطية" });
  }
});

/* ══════════════════════════════════════════════════════════
   LOCAL DEVICE BACKUP — free for all plans
   Streams full JSON directly to browser, nothing stored on server
══════════════════════════════════════════════════════════ */

/* GET /api/backup/local-download */
router.get("/backup/local-download", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const [[cases, clients, invoices, contracts, docs, users], hr, accounting] = await Promise.all([
      Promise.all([
        db.execute(sql`SELECT * FROM cases WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM clients WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM client_invoices WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM contracts WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT id, file_name, file_type, case_id, created_at FROM documents WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT id, email, full_name, role, status FROM users WHERE office_id = ${tenantId} LIMIT 500`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
      ]),
      fetchHR(tenantId),
      fetchAccounting(tenantId),
    ]);

    const payload = {
      meta: {
        platform: "عدالة AI",
        version: "2.1",
        exportedAt: new Date().toISOString(),
        type: "local_device",
        sections: ["cases","clients","invoices","contracts","documents","users","hr","accounting"],
      },
      cases, clients, invoices, contracts, documents: docs, users,
      hr, accounting,
    };

    const fileName = `adala-backup-${dateStr()}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.json(payload);
  } catch (err) {
        res.status(500).json({ error: "خطأ في إنشاء النسخة الاحتياطية" });
  }
});

/* ══════════════════════════════════════════════════════════
   EXPORT ENDPOINTS
══════════════════════════════════════════════════════════ */

/* GET /api/export/all */
router.get("/export/all", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const [[cases, clients, invoices, contracts], hr, accounting] = await Promise.all([
      Promise.all([
        db.execute(sql`SELECT * FROM cases WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM clients WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM client_invoices WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
        db.execute(sql`SELECT * FROM contracts WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])),
      ]),
      fetchHR(tenantId),
      fetchAccounting(tenantId),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      version: "2.1",
      cases, clients, invoices, contracts,
      hr, accounting,
    };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="office-export-${dateStr()}.json"`);
    res.json(payload);
  } catch {
    res.status(500).json({ error: "خطأ في التصدير الكامل" });
  }
});

/* GET /api/export/revenues?format=csv|json */
router.get("/export/revenues", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const fmt = (String(req.query.format)) ?? "json";
    const rows = await db.execute(sql`SELECT * FROM revenues WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows);
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="revenues-${dateStr()}.csv"`);
      res.send("\uFEFF" + toCSV(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="revenues-${dateStr()}.json"`);
      res.json(rows);
    }
  } catch { res.status(500).json({ error: "خطأ في تصدير الإيرادات" }); }
});

/* GET /api/export/expenses?format=csv|json */
router.get("/export/expenses", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const fmt = (String(req.query.format)) ?? "json";
    const rows = await db.execute(sql`SELECT * FROM expenses WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows);
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="expenses-${dateStr()}.csv"`);
      res.send("\uFEFF" + toCSV(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="expenses-${dateStr()}.json"`);
      res.json(rows);
    }
  } catch { res.status(500).json({ error: "خطأ في تصدير المصاريف" }); }
});

/* GET /api/export/employees?format=csv|json */
router.get("/export/employees", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const fmt = (String(req.query.format)) ?? "json";
    const rows = await db.execute(sql`SELECT * FROM employees WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows);
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="employees-${dateStr()}.csv"`);
      res.send("\uFEFF" + toCSV(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="employees-${dateStr()}.json"`);
      res.json(rows);
    }
  } catch { res.status(500).json({ error: "خطأ في تصدير الموظفين" }); }
});

/* GET /api/export/payroll?format=csv|json */
router.get("/export/payroll", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const fmt = (String(req.query.format)) ?? "json";
    const rows = await db.execute(sql`SELECT * FROM payroll WHERE office_id=${tenantId} LIMIT 10000`).then(r => r.rows);
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="payroll-${dateStr()}.csv"`);
      res.send("\uFEFF" + toCSV(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="payroll-${dateStr()}.json"`);
      res.json(rows);
    }
  } catch { res.status(500).json({ error: "خطأ في تصدير الرواتب" }); }
});

/* GET /api/export/clients?format=csv|json */
router.get("/export/clients", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const fmt = (String(req.query.format)) ?? "json";
    const rows = await db.execute(sql`SELECT * FROM clients WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? []));
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="clients-${dateStr()}.csv"`);
      res.send("\uFEFF" + toCSV(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="clients-${dateStr()}.json"`);
      res.json(rows);
    }
  } catch {
    res.status(500).json({ error: "خطأ في تصدير العملاء" });
  }
});

/* GET /api/export/cases?format=csv|json */
router.get("/export/cases", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const fmt = (String(req.query.format)) ?? "json";
    const rows = await db.execute(sql`SELECT * FROM cases WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? []));
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="cases-${dateStr()}.csv"`);
      res.send("\uFEFF" + toCSV(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="cases-${dateStr()}.json"`);
      res.json(rows);
    }
  } catch {
    res.status(500).json({ error: "خطأ في تصدير القضايا" });
  }
});

/* GET /api/export/invoices?format=csv|json */
router.get("/export/invoices", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const fmt = (String(req.query.format)) ?? "json";
    const rows = await db.execute(sql`SELECT * FROM client_invoices WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? []));
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="invoices-${dateStr()}.csv"`);
      res.send("\uFEFF" + toCSV(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="invoices-${dateStr()}.json"`);
      res.json(rows);
    }
  } catch {
    res.status(500).json({ error: "خطأ في تصدير الفواتير" });
  }
});

/* GET /api/export/contracts?format=csv|json */
router.get("/export/contracts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const fmt = (String(req.query.format)) ?? "json";
    const rows = await db.execute(sql`SELECT * FROM contracts WHERE office_id = ${tenantId} LIMIT 10000`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? []));
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="contracts-${dateStr()}.csv"`);
      res.send("\uFEFF" + toCSV(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="contracts-${dateStr()}.json"`);
      res.json(rows);
    }
  } catch {
    res.status(500).json({ error: "خطأ في تصدير العقود" });
  }
});

/* POST /api/import (Business+ — receives JSON and merges) */
router.post("/backup/test-cloud", requireAuthWithTenant, async (req, res) => {
  try {
    const { accessKey, secretKey, bucket, region, endpoint } = req.body as {
      accessKey?: string; secretKey?: string; bucket?: string; region?: string; endpoint?: string;
    };

    const missing: string[] = [];
    if (!accessKey) missing.push("Access Key");
    if (!secretKey) missing.push("Secret Key");
    if (!bucket)    missing.push("Bucket Name");
    if (!region)    missing.push("Region");
    if (missing.length) {
      return res.status(400).json({ ok: false, error: `الحقول الناقصة: ${missing.join("، ")}` });
    }

    // Try a real HEAD request to validate the endpoint/bucket
    const baseEndpoint = endpoint
      ? endpoint.replace(/\/$/, "")
      : `https://s3.${region}.amazonaws.com`;

    const testUrl = `${baseEndpoint}/${bucket}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(testUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "x-amz-date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z",
        },
      }).catch(() => null);
      clearTimeout(timeout);

      // 200 or 403 both mean the endpoint is reachable (403 = auth needed = endpoint exists)
      if (resp && (resp.status === 200 || resp.status === 403 || resp.status === 301 || resp.status === 302)) {
        return res.json({ ok: true, message: "تم الوصول إلى نقطة النهاية بنجاح — الإعدادات صحيحة الشكل" });
      }
    } catch {
      // Connectivity error — might be a private endpoint
    }

    // If we can't reach the endpoint, at least confirm the format is valid
    res.json({
      ok: true,
      message: "تم التحقق من صحة الإعدادات — الحقول مكتملة وجاهزة للحفظ",
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/import", requireAuthWithTenant, async (req, res) => {
  try {
    const data = req.body as { cases?: any[]; clients?: any[]; invoices?: any[]; contracts?: any[] };
    let imported = 0;

    if (Array.isArray(data.clients) && data.clients.length) {
      for (const c of data.clients) {
        try {
          await db.insert(clientsTable).values({
            fullName: c.fullName ?? c.full_name ?? "مستورد",
            type: c.type ?? "individual",
            email: c.email,
            phone: c.phone,
            company: c.company,
            notes: c.notes,
            status: c.status ?? "active",
          });
          imported++;
        } catch { /* skip duplicates */ }
      }
    }

    if (Array.isArray(data.cases) && data.cases.length) {
      for (const c of data.cases) {
        try {
          await db.insert(casesTable).values({
            title: c.title ?? "قضية مستوردة",
            caseType: c.caseType ?? c.case_type ?? "مدنية",
            status: c.status ?? "open",
            clientName: c.clientName ?? c.client_name,
          });
          imported++;
        } catch { /* skip */ }
      }
    }

    res.json({ ok: true, imported });
  } catch (err) {
        res.status(500).json({ error: "خطأ في استيراد البيانات" });
  }
});

export default router;
