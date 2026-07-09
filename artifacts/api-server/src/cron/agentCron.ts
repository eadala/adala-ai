/**
 * Agent Cron — وكلاء الذكاء الاصطناعي التلقائيون
 *
 * يعمل كل ساعة على الخادم السحابي ويُنفّذ 4 وكلاء:
 *  1. case_review      — مراجعة القضايا والجلسات القادمة
 *  2. invoice_reminder — تتبع الفواتير المتأخرة
 *  3. daily_snapshot   — لقطة إحصائية يومية لكل مكتب
 *  4. ai_health_check  — فحص حالة خدمات AI المتصلة
 */

import cron from "node-cron";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { callAI } from "../modules/ai/aiChat";
import { encryptBuffer, isEncryptionEnabled } from "../core/backupEncrypt";
import { uploadBackup, tenantSnapshotKey, fullBackupKey } from "../core/backupStorage";
import { runAsSystemTenant } from "../core/tenant/backgroundScope";
import { withTenantRls } from "../core/tenant/rlsScope";
import { isObjectStorageConfigured } from "../core/storage";

/* ── DB helpers ─────────────────────────────────────── */
async function sqlAll(q: any): Promise<Record<string, any>[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function sqlOne(q: any): Promise<Record<string, any>> {
  return (await sqlAll(q))[0] ?? {};
}
async function sqlExec(q: any): Promise<void> {
  try { await db.execute(q); } catch { /* best-effort */ }
}

/* ── Ensure tables exist ─────────────────────────────── */
async function ensureTables() {
  await sqlExec(sql`
    CREATE TABLE IF NOT EXISTS agent_job_logs (
      id          BIGSERIAL PRIMARY KEY,
      agent_type  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'running',
      office_id   TEXT,
      summary     TEXT,
      details     JSONB,
      duration_ms INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
  await sqlExec(sql`
    CREATE INDEX IF NOT EXISTS idx_agent_job_logs_created ON agent_job_logs(created_at DESC)
  `);
  await sqlExec(sql`
    CREATE INDEX IF NOT EXISTS idx_agent_job_logs_type ON agent_job_logs(agent_type)
  `);
}

/* ── Log helpers ────────────────────────────────────── */
async function logStart(type: string, officeId?: string): Promise<number> {
  const row = await sqlOne(sql`
    INSERT INTO agent_job_logs (agent_type, status, office_id, created_at)
    VALUES (${type}, 'running', ${officeId ?? null}, NOW())
    RETURNING id
  `);
  return Number(row.id ?? 0);
}

async function logDone(id: number, summary: string, details: Record<string, any> = {}) {
  if (!id) return;
  const now = Date.now();
  await sqlExec(sql`
    UPDATE agent_job_logs
    SET status = 'completed', summary = ${summary}, details = ${JSON.stringify(details)}::jsonb,
        completed_at = NOW()
    WHERE id = ${id}
  `);
}

async function logFail(id: number, error: string) {
  if (!id) return;
  await sqlExec(sql`
    UPDATE agent_job_logs
    SET status = 'failed', summary = ${error}, completed_at = NOW()
    WHERE id = ${id}
  `);
}

/* ════════════════════════════════════════════════════════
   AGENT 1 — مراجعة القضايا (Case Review)
   يفحص القضايا التي لها جلسة خلال 24 ساعة أو موعد نهائي
   قادم ويُنشئ ملخصاً بالذكاء الاصطناعي
════════════════════════════════════════════════════════ */
async function listActiveOfficeIds(): Promise<string[]> {
  const rows = await sqlAll(sql`
    SELECT id FROM office_registry
    WHERE status IS NULL OR status IN ('active', 'suspended')
    LIMIT 500
  `);
  return rows.map((r) => String(r.id));
}

async function runCaseReviewAgent() {
  const jobId = await logStart("case_review");
  const t0 = Date.now();
  try {
    const offices = await listActiveOfficeIds();
    const upcomingSessions: Record<string, unknown>[] = [];
    const staleCases: Record<string, unknown>[] = [];

    for (const officeId of offices) {
      await withTenantRls(officeId, async () => {
        const sessions = await sqlAll(sql`
          SELECT c.id, c.title, c.office_id, c.status, c.type,
                 s.session_date, s.court, s.notes
          FROM cases c
          JOIN case_sessions s ON s.case_id = c.id::text
          WHERE c.office_id = ${officeId}
            AND s.session_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
            AND c.status != 'closed'
          ORDER BY s.session_date ASC
          LIMIT 20
        `).catch(() => []);
        const stale = await sqlAll(sql`
          SELECT id, title, office_id, status, updated_at
          FROM cases
          WHERE office_id = ${officeId}
            AND status IN ('open','active','in_progress')
            AND updated_at < NOW() - INTERVAL '7 days'
          LIMIT 10
        `).catch(() => []);
        upcomingSessions.push(...sessions);
        staleCases.push(...stale);
      });
    }

    let aiSummary = "";
    if (upcomingSessions.length > 0 || staleCases.length > 0) {
      const prompt = `أنت وكيل مراجعة قانوني. فيما يلي بيانات القضايا:

جلسات خلال 24 ساعة (${upcomingSessions.length}):
${upcomingSessions.slice(0, 5).map(s => `- "${s.title}" — المحكمة: ${(s as Record<string, unknown>).court ?? "غير محددة"} — ${new Date(String((s as Record<string, unknown>).session_date)).toLocaleString("ar-SA")}`).join("\n") || "لا توجد"}

قضايا بدون نشاط منذ 7 أيام (${staleCases.length}):
${staleCases.slice(0, 5).map(c => `- "${c.title}" (${c.status})`).join("\n") || "لا توجد"}

أعطِ ملخصاً موجزاً (3-4 جمل) بالعربية للوضع العام وأي توصيات عاجلة.`;

      const { reply } = await callAI(
        "أنت وكيل ذكاء اصطناعي متخصص في مراجعة القضايا القانونية. ردودك موجزة واحترافية.",
        prompt
      ).catch(() => ({ reply: "تعذّر إنشاء الملخص — سيُعاد المحاولة في الدورة القادمة." }));
      aiSummary = reply;
    }

    await logDone(jobId, aiSummary || "لا توجد قضايا تستوجب المتابعة الآن", {
      upcomingSessions: upcomingSessions.length,
      staleCases: staleCases.length,
      durationMs: Date.now() - t0,
    });
    logger.info(`[AgentCron] case_review ✅ — ${upcomingSessions.length} جلسات، ${staleCases.length} قضايا متأخرة`);
  } catch (err: any) {
    await logFail(jobId, err.message);
    logger.error({ err }, "[AgentCron] case_review ❌");
  }
}

/* ════════════════════════════════════════════════════════
   AGENT 2 — متابعة الفواتير المتأخرة (Invoice Reminder)
   يفحص الفواتير المتأخرة ويُنشئ سجلاً بالمتعثرين
════════════════════════════════════════════════════════ */
async function runInvoiceReminderAgent() {
  const jobId = await logStart("invoice_reminder");
  const t0 = Date.now();
  try {
    const offices = await listActiveOfficeIds();
    const overdueInvoices: Record<string, unknown>[] = [];

    for (const officeId of offices) {
      await withTenantRls(officeId, async () => {
        const rows = await sqlAll(sql`
          SELECT
            ci.id, ci.invoice_number, ci.office_id,
            ci.total_amount, ci.due_date, ci.status,
            cl.name AS client_name
          FROM client_invoices ci
          LEFT JOIN clients cl ON cl.id = ci.client_id
          WHERE ci.office_id = ${officeId}
            AND ci.status IN ('sent','overdue','partially_paid')
            AND ci.due_date < NOW()
          ORDER BY ci.due_date ASC
          LIMIT 50
        `).catch(() => []);
        overdueInvoices.push(...rows);

        await sqlExec(sql`
          UPDATE client_invoices
          SET status = 'overdue'
          WHERE office_id = ${officeId}
            AND status = 'sent'
            AND due_date < NOW()
        `);
      });
    }

    const totalOverdue = (overdueInvoices as any[]).reduce((sum: number, inv: any) =>
      sum + parseFloat(String(inv.total_amount ?? "0")), 0
    );

    const groupedByOffice = (overdueInvoices as any[]).reduce((acc: Record<string, number>, inv: any) => {
      acc[inv.office_id] = (acc[inv.office_id] ?? 0) + 1;
      return acc;
    }, {});

    await logDone(jobId, `${overdueInvoices.length} فاتورة متأخرة — إجمالي: ${totalOverdue.toLocaleString()} ريال`, {
      overdueCount: overdueInvoices.length,
      totalOverdueAmount: totalOverdue,
      byOffice: groupedByOffice,
      durationMs: Date.now() - t0,
    });
    logger.info(`[AgentCron] invoice_reminder ✅ — ${overdueInvoices.length} فاتورة متأخرة`);
  } catch (err: any) {
    await logFail(jobId, err.message);
    logger.error({ err }, "[AgentCron] invoice_reminder ❌");
  }
}

/* ════════════════════════════════════════════════════════
   AGENT 3 — اللقطة اليومية (Daily Snapshot)
   يجمع إحصائيات يومية لكل مكتب ويخزنها
   يعمل مرة واحدة فقط في اليوم (الساعة 2 صباحاً)
════════════════════════════════════════════════════════ */
async function runDailySnapshotAgent() {
  const jobId = await logStart("daily_snapshot");
  const t0 = Date.now();
  try {
    /* إحصائيات المنصة الكاملة */
    const [
      totalOffices, totalUsers, totalCases, totalContracts,
      todayRevenue, newCasesToday, aiUsageToday
    ] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*)::int AS cnt FROM offices`).catch(() => ({ cnt: 0 })),
      sqlOne(sql`SELECT COUNT(*)::int AS cnt FROM office_members WHERE status='active'`).catch(() => ({ cnt: 0 })),
      sqlOne(sql`SELECT COUNT(*)::int AS cnt FROM cases`).catch(() => ({ cnt: 0 })),
      sqlOne(sql`SELECT COUNT(*)::int AS cnt FROM contracts`).catch(() => ({ cnt: 0 })),
      sqlOne(sql`
        SELECT COALESCE(SUM(amount)::numeric,0) AS total FROM client_invoices
        WHERE status='paid' AND paid_at::date = CURRENT_DATE
      `).catch(() => ({ total: 0 })),
      sqlOne(sql`SELECT COUNT(*)::int AS cnt FROM cases WHERE created_at::date = CURRENT_DATE`).catch(() => ({ cnt: 0 })),
      sqlOne(sql`
        SELECT COALESCE(SUM(credits_used)::numeric,0) AS total FROM ai_credit_log
        WHERE created_at::date = CURRENT_DATE
      `).catch(() => ({ total: 0 })),
    ]);

    const snapshot = {
      date: new Date().toISOString().split("T")[0],
      offices: Number(totalOffices.cnt),
      users: Number(totalUsers.cnt),
      cases: Number(totalCases.cnt),
      contracts: Number(totalContracts.cnt),
      todayRevenue: parseFloat(String(todayRevenue.total ?? 0)),
      newCasesToday: Number(newCasesToday.cnt),
      aiCreditsToday: parseFloat(String(aiUsageToday.total ?? 0)),
    };

    await logDone(jobId,
      `لقطة ${snapshot.date}: ${snapshot.offices} مكتب، ${snapshot.cases} قضية، ${snapshot.todayRevenue.toLocaleString()} ريال`,
      { snapshot, durationMs: Date.now() - t0 }
    );
    logger.info(`[AgentCron] daily_snapshot ✅ — ${snapshot.offices} مكاتب، ${snapshot.todayRevenue} ريال اليوم`);
  } catch (err: any) {
    await logFail(jobId, err.message);
    logger.error({ err }, "[AgentCron] daily_snapshot ❌");
  }
}

/* ════════════════════════════════════════════════════════
   AGENT 4 — فحص حالة AI (AI Health Check)
   يختبر الاتصال بخدمات AI ويسجّل النتائج
════════════════════════════════════════════════════════ */
async function runAiHealthCheckAgent() {
  const jobId = await logStart("ai_health_check");
  const t0 = Date.now();
  try {
    const results: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

    /* فحص Gemini */
    if (process.env.GEMINI_API_KEY) {
      const t = Date.now();
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "ping" }] }],
              generationConfig: { maxOutputTokens: 5 },
            }),
            signal: AbortSignal.timeout(8000),
          }
        );
        results.gemini = { ok: res.ok, latencyMs: Date.now() - t };
      } catch (e: any) {
        results.gemini = { ok: false, error: e.message, latencyMs: Date.now() - t };
      }
    } else {
      results.gemini = { ok: false, error: "GEMINI_API_KEY غير موجود" };
    }

    /* فحص OpenAI */
    if (process.env.OPENAI_API_KEY) {
      const t = Date.now();
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          signal: AbortSignal.timeout(8000),
        });
        results.openai = { ok: res.ok, latencyMs: Date.now() - t };
      } catch (e: any) {
        results.openai = { ok: false, error: e.message, latencyMs: Date.now() - t };
      }
    } else {
      results.openai = { ok: false, error: "OPENAI_API_KEY غير موجود" };
    }

    /* فحص Anthropic */
    if (process.env.ANTHROPIC_API_KEY) {
      const t = Date.now();
      try {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          signal: AbortSignal.timeout(8000),
        });
        results.anthropic = { ok: res.ok, latencyMs: Date.now() - t };
      } catch (e: any) {
        results.anthropic = { ok: false, error: e.message, latencyMs: Date.now() - t };
      }
    } else {
      results.anthropic = { ok: false, error: "ANTHROPIC_API_KEY غير موجود" };
    }

    /* فحص Ollama (إذا كان مفعّلاً) */
    const ollamaUrl = process.env.OLLAMA_BASE_URL;
    if (ollamaUrl) {
      const t = Date.now();
      try {
        const res = await fetch(`${ollamaUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json() as any;
        results.ollama = {
          ok: res.ok,
          latencyMs: Date.now() - t,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        };
        if (res.ok && data.models) {
          (results.ollama as any).models = (data.models as any[]).map((m: any) => m.name).join(", ");
        }
      } catch (e: any) {
        results.ollama = { ok: false, error: e.message, latencyMs: Date.now() - t };
      }
    } else {
      results.ollama = { ok: false, error: "OLLAMA_BASE_URL غير مضبوط" };
    }

    const okCount = Object.values(results).filter(r => r.ok).length;
    const summary = `${okCount}/${Object.keys(results).length} خدمات AI متصلة`;

    await logDone(jobId, summary, { results, durationMs: Date.now() - t0 });
    logger.info(`[AgentCron] ai_health_check ✅ — ${summary}`);
  } catch (err: any) {
    await logFail(jobId, err.message);
    logger.error({ err }, "[AgentCron] ai_health_check ❌");
  }
}

/* ════════════════════════════════════════════════════════
   ENTRY POINT — تسجيل جميع الوكلاء مع Cron
════════════════════════════════════════════════════════ */
export function startAgentCron() {
  ensureTables().then(() => {
    /* ── كل 4 ساعات في production / كل ساعة في dev ── */
    const agentSchedule = process.env.NODE_ENV === "production" ? "0 */4 * * *" : "0 * * * *";
    cron.schedule(agentSchedule, async () => {
      logger.info("[AgentCron] 🤖 Starting agent run…");
      await Promise.allSettled([
        runCaseReviewAgent(),
        runInvoiceReminderAgent(),
        runAiHealthCheckAgent(),
      ]);
      logger.info("[AgentCron] ✅ Agent run complete");
    });

    /* ── يومياً الساعة 2 صباحاً: اللقطة اليومية ── */
    cron.schedule("0 2 * * *", async () => {
      logger.info("[AgentCron] 📊 Starting daily snapshot…");
      await runDailySnapshotAgent();
    });

    /* ── تشغيل فوري عند البدء (بعد 10 ثوانٍ) ── */
    setTimeout(async () => {
      logger.info("[AgentCron] 🚀 Initial AI health check…");
      await runAiHealthCheckAgent();
    }, 10_000);

    logger.info("[AgentCron] ✅ All agents registered — hourly + daily at 02:00");
  }).catch(err => {
    logger.error({ err }, "[AgentCron] ❌ Failed to initialize tables");
  });
}

/* ── تشغيل يدوي لأي وكيل (للـ API) ────────────────── */
export async function runAgentManually(type: string): Promise<{ ok: boolean; message: string }> {
  switch (type) {
    case "case_review":
      await runCaseReviewAgent();
      return { ok: true, message: "تم تشغيل وكيل مراجعة القضايا" };
    case "invoice_reminder":
      await runInvoiceReminderAgent();
      return { ok: true, message: "تم تشغيل وكيل الفواتير المتأخرة" };
    case "daily_snapshot":
      await runDailySnapshotAgent();
      return { ok: true, message: "تم تشغيل وكيل اللقطة اليومية" };
    case "ai_health_check":
      await runAiHealthCheckAgent();
      return { ok: true, message: "تم تشغيل وكيل فحص AI" };
    case "tenant_backup":
      await runTenantBackupCron();
      return { ok: true, message: "تم تشغيل وكيل النسخ الاحتياطي للمكاتب" };
    case "full_backup":
      await runFullBackupCron();
      return { ok: true, message: "تم تشغيل وكيل النسخة الكاملة" };
    default:
      return { ok: false, message: `نوع الوكيل "${type}" غير معروف` };
  }
}

export { sqlAll };

/* ══════════════════════════════════════════════════════════════
   AUTOMATED BACKUP CRONS — AES-256 + Object Storage
   ══════════════════════════════════════════════════════════════ */

/**
 * runTenantBackupCron — كل 6 ساعات
 * يجلب كل المكاتب النشطة من DB وينشئ لقطة مشفّرة لكل منها
 */
async function runTenantBackupCron(): Promise<void> {
  const t0 = Date.now();
  let succeeded = 0;
  let failed    = 0;

  try {
    if (!isObjectStorageConfigured()) {
      logger.info("[BackupCron] ⚠️ Object Storage غير مكوَّن — تخطّي النسخ");
      return;
    }

    const offices = await sqlAll(sql`
      SELECT id FROM office_registry WHERE status = 'active' OR status IS NULL LIMIT 500
    `);

    logger.info(`[BackupCron] 🏢 بدء لقطات ${offices.length} مكتب...`);

    for (const office of offices) {
      const tenantId = String(office.id);
      try {
        await runAsSystemTenant(tenantId, async () => {
        const [cases, clients, invoices] = await Promise.all([
          sqlAll(sql`SELECT id, title, status, created_at FROM cases WHERE office_id=${tenantId} LIMIT 50000`),
          sqlAll(sql`SELECT id, full_name, created_at FROM clients WHERE office_id=${tenantId} LIMIT 50000`),
          sqlAll(sql`SELECT id, amount, status FROM client_invoices WHERE office_id=${tenantId} LIMIT 50000`),
        ]);

        const snapshot   = { tenantId, cases, clients, invoices, createdAt: new Date().toISOString() };
        const jsonBuffer = Buffer.from(JSON.stringify(snapshot), "utf8");
        const payload    = isEncryptionEnabled() ? encryptBuffer(jsonBuffer) : jsonBuffer;
        const key        = tenantSnapshotKey(tenantId);

        await uploadBackup(key, payload);

        await sqlExec(sql`
          INSERT INTO backup_jobs (office_id, file_name, size_bytes, status, backup_type, file_data)
          VALUES (
            ${tenantId},
            ${"auto-snapshot-" + Date.now() + (isEncryptionEnabled() ? ".enc" : ".json")},
            ${payload.length},
            'completed',
            'snapshot',
            ${JSON.stringify({ storageKey: key, encrypted: isEncryptionEnabled(), entityCount: cases.length + clients.length + invoices.length })}
          )
        `);
        });
        succeeded++;
      } catch (e) {
        failed++;
        logger.warn({ err: e, tenantId }, `[BackupCron] ❌ فشل مكتب ${tenantId}`);
      }
    }

    logger.info(`[BackupCron] ✅ لقطات: ${succeeded} نجح، ${failed} فشل — ${Date.now() - t0}ms`);
  } catch (err) {
    logger.error({ err }, "[BackupCron] ❌ Tenant backup cron failed");
  }
}

/**
 * runFullBackupCron — يومياً الساعة 02:30
 * لقطة إحصائية كاملة مشفّرة لكل النظام
 */
async function runFullBackupCron(): Promise<void> {
  const t0 = Date.now();
  try {
    if (!isObjectStorageConfigured()) {
      logger.info("[BackupCron] ⚠️ Object Storage غير مكوَّن — تخطّي النسخة الكاملة");
      return;
    }

    const [officeCount, caseCount, clientCount, invoiceCount] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*) AS c FROM office_registry`).then(r => Number(r.c ?? 0)),
      sqlOne(sql`SELECT COUNT(*) AS c FROM cases`).then(r => Number(r.c ?? 0)),
      sqlOne(sql`SELECT COUNT(*) AS c FROM clients`).then(r => Number(r.c ?? 0)),
      sqlOne(sql`SELECT COUNT(*) AS c FROM client_invoices`).then(r => Number(r.c ?? 0)),
    ]);

    const fullSnapshot = {
      type: "full_system",
      createdAt: new Date().toISOString(),
      stats: { officeCount, caseCount, clientCount, invoiceCount },
      version: "2.0-aes256",
    };

    const jsonBuffer = Buffer.from(JSON.stringify(fullSnapshot), "utf8");
    const payload    = isEncryptionEnabled() ? encryptBuffer(jsonBuffer) : jsonBuffer;
    const key        = fullBackupKey();

    await uploadBackup(key, payload);

    logger.info(`[BackupCron] ✅ نسخة كاملة: ${officeCount} مكتب، ${caseCount} قضية — ${key} — ${Date.now() - t0}ms`);
  } catch (err) {
    logger.error({ err }, "[BackupCron] ❌ Full backup cron failed");
  }
}

/* Register backup crons after main crons are already set up */
setTimeout(() => {
  /* لقطات المكاتب كل 6 ساعات */
  cron.schedule("0 */6 * * *", () => {
    logger.info("[BackupCron] 🔐 Starting tenant snapshots (6h cycle)…");
    runTenantBackupCron();
  });

  /* نسخة كاملة يومياً الساعة 02:30 (30 دقيقة بعد daily_snapshot) */
  cron.schedule("30 2 * * *", () => {
    logger.info("[BackupCron] 💾 Starting full system backup (daily 02:30)…");
    runFullBackupCron();
  });

  logger.info("[BackupCron] ✅ Backup crons registered — tenant every 6h + full daily at 02:30");
}, 2_000);

