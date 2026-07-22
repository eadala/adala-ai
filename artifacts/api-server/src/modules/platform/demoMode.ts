import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { classifyDemoSeedError, isDemoSeedEnabled } from "./demoSeedPolicy";

export { classifyDemoSeedError, isDemoSeedEnabled } from "./demoSeedPolicy";

const router = Router();

const DEMO_OFFICE_ID = "ddddeeee-0000-0000-0000-000000000099";
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@adalah-ai.sa";
const DEMO_PASS  = process.env.DEMO_PASSWORD ?? "Demo@2025!";

async function ensureDemoData() {
  if (!isDemoSeedEnabled()) {
    /* Production default is silent skip; explicit false logs once for operators. */
    if (process.env.DEMO_SEED_ENABLED === "false") {
      logger.info(
        { nodeEnv: process.env.NODE_ENV },
        "[Demo] Seed skipped — DEMO_SEED_ENABLED=false",
      );
    }
    return;
  }

  try {
    /* office_registry.id is TEXT PK — store canonical UUID string without ::uuid cast */
    await db.execute(sql`
      INSERT INTO office_registry (id, clerk_user_id, owner_email, office_name, plan_name, status, joined_at)
      VALUES (${DEMO_OFFICE_ID}, 'demo_user_seed', ${DEMO_EMAIL}, 'مكتب التجربة — عدالة AI', 'professional', 'active', NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    const clientIds = [
      "dddd0001-0000-0000-0000-000000000001",
      "dddd0002-0000-0000-0000-000000000002",
      "dddd0003-0000-0000-0000-000000000003",
    ];
    const clientData = [
      { id: clientIds[0], name: "شركة النخبة للاستثمار", email: "info@nukhba.sa",    phone: "0501234567", type: "company"    },
      { id: clientIds[1], name: "خالد بن عبدالله الزهراني", email: "k.zahrani@gmail.com", phone: "0559876543", type: "individual" },
      { id: clientIds[2], name: "مجموعة الأفق التجارية", email: "legal@ufuq.sa",    phone: "0112345678", type: "company"    },
    ];
    for (const c of clientData) {
      /* clients.id is UUID PK */
      await db.execute(sql`
        INSERT INTO clients (id, full_name, email, phone, type, office_id, created_at)
        VALUES (${c.id}::uuid, ${c.name}, ${c.email}, ${c.phone}, ${c.type}, ${DEMO_OFFICE_ID}, NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    }

    const caseData = [
      { id: "ddddca01-0000-0000-0000-000000000001", title: "نزاع عقاري — حي الملقا",            type: "عقاري",        status: "open",    clientName: "شركة النخبة للاستثمار",      cn: "2025/E/1024"  },
      { id: "ddddca02-0000-0000-0000-000000000002", title: "مطالبة تأمينية — حادثة مرورية",     type: "تأمين",        status: "open",    clientName: "خالد بن عبدالله الزهراني",  cn: "2025/T/0387"  },
      { id: "ddddca03-0000-0000-0000-000000000003", title: "عقد شراكة تجارية — طلب تحكيم",     type: "تجاري",        status: "pending", clientName: "مجموعة الأفق التجارية",     cn: "2025/C/0291"  },
      { id: "ddddca04-0000-0000-0000-000000000004", title: "دعوى عمالية — فصل تعسفي",          type: "عمالي",        status: "open",    clientName: "خالد بن عبدالله الزهراني",  cn: "2025/L/0534"  },
      { id: "ddddca05-0000-0000-0000-000000000005", title: "قضية ملكية فكرية — علامة تجارية",  type: "ملكية فكرية", status: "closed",  clientName: "شركة النخبة للاستثمار",      cn: "2024/IP/0198" },
    ];
    for (const c of caseData) {
      /* cases.id is TEXT PK; ON CONFLICT (id) matches PRIMARY KEY */
      await db.execute(sql`
        INSERT INTO cases (id, title, case_number, case_type, status, client_name, office_id, created_at, updated_at)
        VALUES (${c.id}, ${c.title}, ${c.cn}, ${c.type}, ${c.status}, ${c.clientName}, ${DEMO_OFFICE_ID}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    }

    logger.info("[Demo] Seed data ready ✅");
  } catch (e) {
    const classified = classifyDemoSeedError(e);
    logger.warn(
      {
        err: e,
        pgCode: classified.code,
        reason: classified.reason,
        hint: "cases.case_number and court columns are owned by migration 017_cases_schema.sql",
      },
      `[Demo] Seed skipped — ${classified.reason}${classified.code ? ` (${classified.code})` : ""}`,
    );
  }
}

ensureDemoData();

/* ── GET /api/demo/credentials (public) ────────────────────────────────── */
router.get("/credentials", (req, res) => {
  res.json({
    email:    DEMO_EMAIL,
    password: DEMO_PASS,
    officeId: DEMO_OFFICE_ID,
    note:     "بيانات التجربة — تُعاد إلى الوضع الافتراضي يومياً",
  });
});

/* ── GET /api/demo/stats (public) ─ high-level numbers for landing ─────── */
router.get("/stats", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM cases   WHERE office_id = ${DEMO_OFFICE_ID}) AS case_count,
        (SELECT COUNT(*) FROM clients WHERE office_id = ${DEMO_OFFICE_ID}) AS client_count
    `);
    const list = (rows as { rows?: Array<Record<string, unknown>> }).rows
      ?? (rows as unknown as Array<Record<string, unknown>>);
    const r = list?.[0] ?? {};
    res.json({ cases: Number(r.case_count ?? 5), clients: Number(r.client_count ?? 3), offices: 47, ai_tasks: 312 });
  } catch {
    res.json({ cases: 5, clients: 3, offices: 47, ai_tasks: 312 });
  }
});

export default router;
