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
  if (!bucket) return { name: "storage", label: "التخزين", status: "degraded", detail: "لا يوجد bucket مضبوط" };
  return { name: "storage", label: "التخزين", status: "operational" };
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
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { name: "payments", label: "المدفوعات", status: "degraded", detail: "Stripe غير مضبوط" };
  return { name: "payments", label: "المدفوعات", status: "operational" };
}

/* GET /api/status — public endpoint */
router.get("/status", async (_req, res) => {
  try {
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

    /* persist checks */
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
