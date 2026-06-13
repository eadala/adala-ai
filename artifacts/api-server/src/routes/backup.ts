import { Router } from "express";
import { db } from "@workspace/db";
import {
  backupSettingsTable, backupJobsTable,
  casesTable, clientsTable, clientInvoicesTable,
  contractsTable, documentsTable, usersTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

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
router.get("/backup/settings", async (_req, res) => {
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
router.put("/backup/settings", async (req, res) => {
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
router.get("/backup/jobs", async (_req, res) => {
  try {
    const jobs = await db
      .select({
        id:           backupJobsTable.id,
        type:         backupJobsTable.type,
        scheduleType: backupJobsTable.scheduleType,
        status:       backupJobsTable.status,
        sizeBytes:    backupJobsTable.sizeBytes,
        fileName:     backupJobsTable.fileName,
        errorMessage: backupJobsTable.errorMessage,
        createdAt:    backupJobsTable.createdAt,
        completedAt:  backupJobsTable.completedAt,
      })
      .from(backupJobsTable)
      .orderBy(desc(backupJobsTable.createdAt))
      .limit(100);
    res.json(jobs);
  } catch {
    res.status(500).json({ error: "خطأ في جلب سجل النسخ" });
  }
});

/* POST /api/backup/create */
router.post("/backup/create", async (req, res) => {
  try {
    const { type = "manual", scheduleType } = req.body as { type?: string; scheduleType?: string };

    const [cases, clients, invoices, contracts, docs, users] = await Promise.all([
      db.select().from(casesTable).limit(10000),
      db.select().from(clientsTable).limit(10000),
      db.select().from(clientInvoicesTable).limit(10000),
      db.select().from(contractsTable).limit(10000),
      db.select({
        id: documentsTable.id,
        fileName: documentsTable.fileName,
        fileType: documentsTable.fileType,
        caseId: documentsTable.caseId,
        createdAt: documentsTable.createdAt,
      }).from(documentsTable).limit(10000),
      db.select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        status: usersTable.status,
      }).from(usersTable).limit(500),
    ]);

    const payload = {
      meta: {
        platform: "عدالة AI",
        version: "2.0",
        createdAt: new Date().toISOString(),
        type,
      },
      cases,
      clients,
      invoices,
      contracts,
      documents: docs,
      users,
    };

    const dataStr = JSON.stringify(payload, null, 2);
    const sizeBytes = Buffer.byteLength(dataStr, "utf8");
    const fileName = `backup-${dateStr()}.json`;

    const [job] = await db
      .insert(backupJobsTable)
      .values({ type, scheduleType, status: "completed", sizeBytes, fileName, fileData: dataStr, completedAt: new Date() })
      .returning({ id: backupJobsTable.id });

    const settings = await db.select().from(backupSettingsTable).limit(1);
    if (settings.length) {
      await db.update(backupSettingsTable)
        .set({ lastBackupAt: new Date(), updatedAt: new Date() })
        .where(eq(backupSettingsTable.id, settings[0].id));
    }

    res.json({ ok: true, jobId: job.id, fileName, sizeBytes });
  } catch (err) {
    console.error("Backup create error:", err);
    res.status(500).json({ error: "خطأ في إنشاء النسخة الاحتياطية" });
  }
});

/* GET /api/backup/jobs/:id/download */
router.get("/backup/jobs/:id/download", async (req, res) => {
  try {
    const [job] = await db
      .select()
      .from(backupJobsTable)
      .where(eq(backupJobsTable.id, req.params.id))
      .limit(1);
    if (!job) return res.status(404).json({ error: "النسخة الاحتياطية غير موجودة" });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${job.fileName ?? "backup.json"}"`);
    res.send(job.fileData ?? "{}");
  } catch {
    res.status(500).json({ error: "خطأ في تحميل النسخة الاحتياطية" });
  }
});

/* DELETE /api/backup/jobs/:id */
router.delete("/backup/jobs/:id", async (req, res) => {
  try {
    await db.delete(backupJobsTable).where(eq(backupJobsTable.id, req.params.id));
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
router.get("/backup/local-download", async (req, res) => {
  try {
    const [cases, clients, invoices, contracts, docs, users] = await Promise.all([
      db.select().from(casesTable).limit(10000),
      db.select().from(clientsTable).limit(10000),
      db.select().from(clientInvoicesTable).limit(10000),
      db.select().from(contractsTable).limit(10000),
      db.select({
        id: documentsTable.id,
        fileName: documentsTable.fileName,
        fileType: documentsTable.fileType,
        caseId: documentsTable.caseId,
        createdAt: documentsTable.createdAt,
      }).from(documentsTable).limit(10000),
      db.select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        status: usersTable.status,
      }).from(usersTable).limit(500),
    ]);

    const payload = {
      meta: { platform: "عدالة AI", version: "2.0", exportedAt: new Date().toISOString(), type: "local_device" },
      cases, clients, invoices, contracts, documents: docs, users,
    };

    const fileName = `adala-backup-${dateStr()}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.json(payload);
  } catch (err) {
    console.error("Local backup error:", err);
    res.status(500).json({ error: "خطأ في إنشاء النسخة الاحتياطية" });
  }
});

/* ══════════════════════════════════════════════════════════
   EXPORT ENDPOINTS
══════════════════════════════════════════════════════════ */

/* GET /api/export/all */
router.get("/export/all", async (req, res) => {
  try {
    const [cases, clients, invoices, contracts] = await Promise.all([
      db.select().from(casesTable).limit(10000),
      db.select().from(clientsTable).limit(10000),
      db.select().from(clientInvoicesTable).limit(10000),
      db.select().from(contractsTable).limit(10000),
    ]);
    const payload = { exportedAt: new Date().toISOString(), cases, clients, invoices, contracts };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="office-export-${dateStr()}.json"`);
    res.json(payload);
  } catch {
    res.status(500).json({ error: "خطأ في التصدير الكامل" });
  }
});

/* GET /api/export/clients?format=csv|json */
router.get("/export/clients", async (req, res) => {
  try {
    const fmt = (req.query.format as string) ?? "json";
    const rows = await db.select().from(clientsTable).limit(10000);
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
router.get("/export/cases", async (req, res) => {
  try {
    const fmt = (req.query.format as string) ?? "json";
    const rows = await db.select().from(casesTable).limit(10000);
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
router.get("/export/invoices", async (req, res) => {
  try {
    const fmt = (req.query.format as string) ?? "json";
    const rows = await db.select().from(clientInvoicesTable).limit(10000);
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
router.get("/export/contracts", async (req, res) => {
  try {
    const fmt = (req.query.format as string) ?? "json";
    const rows = await db.select().from(contractsTable).limit(10000);
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
router.post("/import", async (req, res) => {
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
    console.error("Import error:", err);
    res.status(500).json({ error: "خطأ في استيراد البيانات" });
  }
});

export default router;
