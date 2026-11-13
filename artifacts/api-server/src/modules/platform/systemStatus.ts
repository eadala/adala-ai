/* eslint-disable @typescript-eslint/no-explicit-any -- drizzle execute row typing */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

interface ServiceCheck {
  name: string;
  label: string;
  status: "operational" | "degraded" | "outage";
  latencyMs?: number;
  detail?: string;
}

async function checkDatabase(): Promise<ServiceCheck> {
  const t0 = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { name: "database", label: "قاعدة البيانات", status: "operational", latencyMs: Date.now() - t0 };
  } catch {
    return { name: "database", label: "قاعدة البيانات", status: "outage", latencyMs: Date.now() - t0 };
  }
}

async function checkAI(): Promise<ServiceCheck> {
  const key = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return { name: "ai", label: "الذكاء الاصطناعي", status: "degraded", detail: "لا توجد مفاتيح API" };
  return { name: "ai", label: "الذكاء الاصطناعي", status: "operational" };
}

async function checkStorage(): Promise<ServiceCheck> {
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  const hasReplitStorage = process.env.REPLIT_CONNECTORS_HOSTNAME || process.env.REPL_ID;
  const hasR2 =
    !!(process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || process.env.S3_BUCKET) &&
    !!(process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
    !!(process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY);
  if (hasR2) {
    return { name: "storage", label: "التخزين", status: "operational", detail: "Cloudflare R2 / S3" };
  }
  if (bucket || hasReplitStorage) {
    return { name: "storage", label: "التخزين", status: "operational" };
  }
  return { name: "storage", label: "التخزين", status: "degraded", detail: "لا يوجد bucket مضبوط" };
}

async function checkEmail(): Promise<ServiceCheck> {
  try {
    const r = await db.execute(sql`
      SELECT COUNT(*)::int as total FROM email_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
        AND status = 'failed'
    `) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    const failures = rows[0]?.total ?? 0;
    if (failures > 10) return { name: "email", label: "البريد الإلكتروني", status: "degraded", detail: `${failures} فشل في آخر ساعة` };
    return { name: "email", label: "البريد الإلكتروني", status: "operational" };
  } catch {
    return { name: "email", label: "البريد الإلكتروني", status: "operational" };
  }
}

async function checkWhatsApp(): Promise<ServiceCheck> {
  try {
    const r = await db.execute(sql`
      SELECT COUNT(*)::int as fails FROM telegram_logs
      WHERE created_at > NOW() - INTERVAL '1 hour' AND status = 'failed'
    `) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    const fails = rows[0]?.fails ?? 0;
    if (fails > 5) return { name: "whatsapp", label: "واتساب / تيليجرام", status: "degraded", detail: `${fails} فشل في آخر ساعة` };
    return { name: "whatsapp", label: "واتساب / تيليجرام", status: "operational" };
  } catch {
    return { name: "whatsapp", label: "واتساب / تيليجرام", status: "operational" };
  }
}

async function checkPayments(): Promise<ServiceCheck> {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const moyasarKey = process.env.MOYASAR_SECRET_KEY?.trim() || process.env.MOYASAR_API_KEY?.trim();
  const hasReplitConnectors = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const hasReplitToken = process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL;

  if (stripeKey) {
    if (stripeKey.startsWith("sk_live_") && !stripeWebhook) {
      return {
        name: "payments",
        label: "المدفوعات",
        status: "degraded",
        detail: "Stripe live بدون STRIPE_WEBHOOK_SECRET",
      };
    }
    return { name: "payments", label: "المدفوعات", status: "operational", detail: "Stripe" };
  }
  if (moyasarKey) {
    return { name: "payments", label: "المدفوعات", status: "operational", detail: "Moyasar" };
  }
  if (hasReplitConnectors && hasReplitToken) {
    return { name: "payments", label: "المدفوعات", status: "operational", detail: "Replit connectors" };
  }
  /* Payments optional for core platform — report degraded, not platform outage */
  return {
    name: "payments",
    label: "المدفوعات",
    status: "degraded",
    detail: "لا بوابة دفع مضبوطة (Stripe/Moyasar)",
  };
}

async function collectStatus() {
  const [database, ai, storage, email, whatsapp, payments] = await Promise.all([
    checkDatabase(),
    checkAI(),
    checkStorage(),
    checkEmail(),
    checkWhatsApp(),
    checkPayments(),
  ]);

  const services: ServiceCheck[] = [database, ai, storage, email, whatsapp, payments];
  const outage = services.filter(s => s.status === "outage").length;
  const degraded = services.filter(s => s.status === "degraded").length;

  const overall =
    outage > 0 ? "outage" :
    degraded > 0 ? "degraded" :
    "operational";

  const overallLabel =
    overall === "operational" ? "جميع الأنظمة تعمل بشكل طبيعي" :
    overall === "degraded"    ? "أداء متأثر في بعض الخدمات" :
    "عطل في خدمة أو أكثر";

  return { services, overall, overallLabel };
}

/* GET /api/status — public endpoint */
router.get("/status", async (_req, res) => {
  try {
    const { services, overall, overallLabel } = await collectStatus();

    for (const svc of services) {
      await db.execute(sql`
        INSERT INTO service_status (service_name, status, message, checked_at)
        VALUES (${svc.name}, ${svc.status}, ${svc.detail ?? null}, NOW())
        ON CONFLICT (service_name) DO UPDATE
          SET status = EXCLUDED.status, message = EXCLUDED.message, checked_at = EXCLUDED.checked_at
      `).catch(() => {});
    }

    res.json({
      overall,
      overallLabel,
      checkedAt: new Date().toISOString(),
      services,
    });
  } catch (e: any) {
    res.status(500).json({ overall: "outage", overallLabel: "تعذر فحص الحالة", error: e.message });
  }
});

/**
 * GET /api/readyz — load balancer readiness.
 * 200 when database is up; 503 on DB outage. Payments/AI degraded does not fail readiness.
 */
router.get("/readyz", async (_req, res) => {
  try {
    const database = await checkDatabase();
    if (database.status === "outage") {
      res.status(503).json({ ok: false, status: "not_ready", database });
      return;
    }
    res.json({
      ok: true,
      status: "ready",
      database,
      sha: process.env.GITHUB_SHA || process.env.COOLIFY_GIT_COMMIT_SHA || null,
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(503).json({ ok: false, status: "not_ready", error: e.message });
  }
});

/** GET /api/version — deploy identity for operators */
router.get("/version", (_req, res) => {
  res.json({
    ok: true,
    sha: process.env.GITHUB_SHA || process.env.COOLIFY_GIT_COMMIT_SHA || null,
    ref: process.env.GITHUB_REF_NAME || process.env.COOLIFY_BRANCH || null,
    version: process.env.APP_VERSION || null,
    nodeEnv: process.env.NODE_ENV || null,
    checkedAt: new Date().toISOString(),
  });
});

/* GET /api/status/history — last 30 days uptime */
router.get("/status/history", async (_req, res) => {
  try {
    const r = await db.execute(sql`
      SELECT service_name, status, message, checked_at
      FROM service_status
      ORDER BY checked_at DESC
      LIMIT 100
    `) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    res.json({ history: rows });
  } catch {
    res.json({ history: [] });
  }
});

export default router;
