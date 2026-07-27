/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; pagination touch-up */
import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db, aiTasksTable, casesTable } from "@workspace/db";
import { and, eq, sql, asc, count, inArray } from "drizzle-orm";
import { ListAiTasksQueryParams, CreateAiTaskBody } from "@workspace/api-zod";
import { listPageEnvelope, resolveDualModePaging } from "../../lib/paginationSafety";

const router = Router();

router.get("/tasks", requireAuthWithTenant, async (req, res) => {
  try {
    const query = ListAiTasksQueryParams.parse(req.query);
    const { paginated, page, limit, offset } = resolveDualModePaging(req.query, 50);

    const where = and(
      query.status ? eq(aiTasksTable.status, query.status) : sql`true`,
      query.caseId ? eq(aiTasksTable.caseId, query.caseId) : sql`true`,
    );

    /*
     * NOTE (tracked separately — do not fix here):
     * GET /tasks has no office_id / tenant filter. Pre-existing authorization gap.
     */
    const [tasks, aggRow] = await Promise.all([
      db.select().from(aiTasksTable)
        .where(where)
        .orderBy(asc(aiTasksTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(aiTasksTable).where(where)
        .then((rows) => rows[0]),
    ]);

    const caseIds = [...new Set(tasks.map((t) => t.caseId).filter(Boolean))] as string[];
    const cases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable)
          .where(inArray(casesTable.id, caseIds))
      : [];
    const caseMap = Object.fromEntries(cases.map((c) => [c.id, c.title]));

    const mapped = tasks.map((t) => ({
      id: t.id, caseId: t.caseId, caseName: t.caseId ? (caseMap[t.caseId] ?? null) : null,
      documentId: t.documentId, type: t.type, status: t.status, priority: t.priority,
      inputText: t.inputText, outputText: t.outputText,
      createdAt: t.createdAt.toISOString(),
    }));

    if (!paginated) return res.json(mapped);
    res.json(listPageEnvelope(mapped, Number(aggRow?.total ?? 0), page, limit));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/tasks", requireAuthWithTenant, async (req, res) => {
  try {
    const body = CreateAiTaskBody.parse(req.body);
    const [created] = await db.insert(aiTasksTable).values({
      caseId: body.caseId ?? null,
      documentId: body.documentId ?? null,
      type: body.type,
      status: "pending",
      priority: body.priority ?? 3,
      inputText: body.inputText ?? null,
    }).returning();

    // Simulate async AI processing
    setTimeout(async () => {
      const outputs: Record<string, string> = {
        summarize: "ملخص: هذا المستند يتضمن معلومات قانونية تتعلق بالقضية المحددة، ويحتوي على نقاط رئيسية تتعلق بالحقوق والالتزامات.",
        risk_analysis: "تحليل المخاطر: تم تحديد 3 مخاطر رئيسية — مخاطر إجرائية متوسطة، مخاطر قانونية منخفضة، ومخاطر تقادم عالية تستوجب المتابعة الفورية.",
        extract: "البيانات المستخرجة: الأطراف — المدعي: أحمد محمد، المدعى عليه: شركة الخليج. التاريخ: 15 يناير 2025. المبلغ المتنازع عليه: 250,000 ريال.",
      };
      const out = outputs[created.type] ?? "اكتملت المعالجة بنجاح.";
      await db.update(aiTasksTable).set({ status: "done", outputText: out }).where(eq(aiTasksTable.id, created.id));
    }, 3000);

    res.status(201).json({ ...created, caseName: null, createdAt: created.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/tasks/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const [found] = await db.select().from(aiTasksTable).where(eq(aiTasksTable.id, String(req.params.id)));
    if (!found) return res.status(404).json({ error: "Not found" });
    let caseName: string | null = null;
    if (found.caseId) {
      const [c] = await db.select({ title: casesTable.title }).from(casesTable).where(eq(casesTable.id, found.caseId));
      caseName = c?.title ?? null;
    }
    res.json({ ...found, caseName, createdAt: found.createdAt.toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
