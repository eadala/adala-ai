import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

async function sqlAll(q: any) {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/* ─── Import Clients ─────────────────────────────────────────────────── */
router.post("/import/clients", requireAuthWithTenant, async (req, res) => {
  try {
    const { rows } = req.body as { rows: any[] };
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: "لا توجد بيانات للاستيراد" });
    if (rows.length > 500)
      return res.status(400).json({ error: "الحد الأقصى 500 سجل في كل مرة" });

    let inserted = 0, errors: string[] = [];
    for (const r of rows) {
      try {
        const name = (r.name || r.الاسم || r.Name || "").trim();
        if (!name) { errors.push(`صف بدون اسم`); continue; }
        const email = (r.email || r.البريد || r.Email || "").trim() || null;
        const phone = (r.phone || r.الهاتف || r.Phone || "").trim() || null;
        const type  = (r.type || r.النوع || r.Type || "individual").trim();
        const city  = (r.city || r.المدينة || r.City || "").trim() || null;
        await db.execute(sql`
          INSERT INTO clients (name, email, phone, type, city, status, office_id)
          VALUES (${name}, ${email}, ${phone}, ${type}, ${city}, 'active', 'default')
          ON CONFLICT DO NOTHING
        `);
        inserted++;
      } catch (e: any) { errors.push(e.message); }
    }
    res.json({ inserted, errors: errors.slice(0, 10), total: rows.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─── Import Cases ───────────────────────────────────────────────────── */
router.post("/import/cases", requireAuthWithTenant, async (req, res) => {
  try {
    const { rows } = req.body as { rows: any[] };
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: "لا توجد بيانات للاستيراد" });
    if (rows.length > 500)
      return res.status(400).json({ error: "الحد الأقصى 500 سجل في كل مرة" });

    let inserted = 0, errors: string[] = [];
    for (const r of rows) {
      try {
        const title = (r.title || r.العنوان || r.Title || "").trim();
        if (!title) { errors.push(`صف بدون عنوان`); continue; }
        const caseNumber  = (r.case_number || r.رقم_القضية || r["Case Number"] || "").trim() || null;
        const caseType    = (r.type || r.النوع || r.Type || "civil").trim();
        const status      = (r.status || r.الحالة || r.Status || "open").trim();
        const court       = (r.court || r.المحكمة || r.Court || "").trim() || null;
        const description = (r.description || r.الوصف || r.Description || "").trim() || null;
        await db.execute(sql`
          INSERT INTO cases (title, case_number, type, status, court, description, office_id)
          VALUES (${title}, ${caseNumber}, ${caseType}, ${status}, ${court}, ${description}, 'default')
          ON CONFLICT DO NOTHING
        `);
        inserted++;
      } catch (e: any) { errors.push(e.message); }
    }
    res.json({ inserted, errors: errors.slice(0, 10), total: rows.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
