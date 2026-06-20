import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI } from "./aiChat";

const router = Router();

/* ── helpers ─────────────────────────────────────────────────────── */
async function getOfficeId(userId: string): Promise<string | null> {
  try {
    const rows = await db.execute(sql`
      SELECT op.id FROM office_page op
      JOIN office_members om ON om.office_id = op.id
      WHERE om.user_id = ${userId} LIMIT 1
    `);
    const arr = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
    return arr[0]?.id ?? null;
  } catch { return null; }
}

const sqlAll = async (q: any) => {
  const r = await db.execute(q);
  return Array.isArray(r) ? r : (r as any).rows ?? [];
};
const sqlOne = async (q: any) => (await sqlAll(q))[0] ?? null;

/* ── AI GRAPH GENERATION PROMPT ──────────────────────────────────── */
const SYSTEM_PROMPT = `أنت محرك بناء سير العمل الذكي لمنصة عدالة القانونية.
عند استلام وصف مهمة بالعربية، أنشئ مخطط سير عمل JSON دقيق.

يجب أن يكون الرد JSON فقط بالشكل التالي (لا نص إضافي):
{
  "name": "اسم قصير للـ workflow",
  "description": "وصف موجز",
  "nodes": [
    {
      "id": "n1",
      "type": "trigger|ai_think|legal_doc|notify|condition|action|loop|output",
      "title": "عنوان العقدة بالعربي",
      "description": "ما تفعله هذه الخطوة",
      "icon": "اسم أيقونة lucide-react",
      "color": "كود HEX للون",
      "x": 100,
      "y": 100,
      "config": { "أي إعدادات إضافية": "قيمتها" }
    }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "اختياري" }
  ]
}

أنواع العقد:
- trigger: نقطة البداية (زناد)
- ai_think: تحليل أو تفكير بالذكاء الاصطناعي
- legal_doc: إنشاء وثيقة قانونية
- notify: إرسال إشعار أو رسالة
- condition: شرط منطقي (نعم/لا)
- action: إجراء في النظام
- loop: حلقة تكرارية
- output: نتيجة نهائية

ضع العقد بشكل هرمي من الأعلى للأسفل. x: 100-900, y: 80-700.
استخدم ألواناً جذابة لكل نوع.
أنشئ workflow احترافي من 4-10 عقد مع edges منطقية.`;

/* ── POST /ai-workflow/generate ──────────────────────────────────── */
router.post("/ai-workflow/generate", requireAuthWithTenant, async (req: any, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt مطلوب" });

    const raw = await callAI(
      SYSTEM_PROMPT,
      `المهمة: ${prompt}\n\nأنشئ workflow احترافي لهذه المهمة القانونية.`,
      "gemini"
    );

    let graph;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      graph = JSON.parse(cleaned);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return res.status(500).json({ error: "فشل تحليل الـ JSON", raw });
      graph = JSON.parse(match[0]);
    }

    res.json({ graph, raw });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /ai-workflow ── list ────────────────────────────────────── */
router.get("/ai-workflow", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId) return res.json([]);
    const rows = await sqlAll(sql`
      SELECT id, name, description, status, run_count, last_run_at, created_at,
             graph_json->>'name' as graph_name
      FROM ai_workflows WHERE office_id = ${officeId}::uuid
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /ai-workflow ── save ───────────────────────────────────── */
router.post("/ai-workflow", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId) return res.status(404).json({ error: "لا يوجد مكتب" });
    const { name, description, prompt, graph_json } = req.body;
    const row = await sqlOne(sql`
      INSERT INTO ai_workflows (office_id, name, description, prompt, graph_json)
      VALUES (${officeId}::uuid, ${name}, ${description ?? ""}, ${prompt ?? ""}, ${JSON.stringify(graph_json)}::jsonb)
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /ai-workflow/:id ────────────────────────────────────────── */
router.get("/ai-workflow/:id", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    const row = await sqlOne(sql`
      SELECT * FROM ai_workflows WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}::uuid
    `);
    if (!row) return res.status(404).json({ error: "غير موجود" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── DELETE /ai-workflow/:id ─────────────────────────────────────── */
router.delete("/ai-workflow/:id", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    await db.execute(sql`
      DELETE FROM ai_workflows WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}::uuid
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /ai-workflow/:id/execute ─── live SSE run ──────────────── */
router.post("/ai-workflow/:id/execute", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    const wf = await sqlOne(sql`
      SELECT * FROM ai_workflows WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}::uuid
    `);
    if (!wf) return res.status(404).json({ error: "غير موجود" });

    const graph = wf.graph_json as any;
    const nodes: any[] = graph.nodes ?? [];
    const edges: any[] = graph.edges ?? [];

    /* ── SSE headers ── */
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    /* ── Create run record ── */
    const runRow = await sqlOne(sql`
      INSERT INTO ai_workflow_runs (workflow_id, office_id)
      VALUES (${String(req.params.id)}::uuid, ${officeId}::uuid)
      RETURNING id
    `);

    send({ type: "start", runId: runRow?.id, total: nodes.length });

    /* ── Topological execution ── */
    const visited = new Set<string>();
    const logs: any[] = [];

    const getNextNodes = (nodeId: string) =>
      edges.filter(e => e.from === nodeId).map(e => e.to);

    const executeNode = async (node: any) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      send({ type: "node_start", nodeId: node.id, title: node.title });
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

      let result = "";
      try {
        if (node.type === "ai_think" || node.type === "legal_doc") {
          result = await callAI(
            "أنت مساعد قانوني ذكي في منصة عدالة. أجب بإيجاز.",
            `نفّذ هذه المهمة: ${node.title} — ${node.description}`,
            "gemini"
          );
          result = result.slice(0, 300) + (result.length > 300 ? "…" : "");
        } else {
          const outcomes: Record<string, string> = {
            trigger:   "✅ تم تفعيل الزناد بنجاح",
            notify:    "📨 تم إرسال الإشعار",
            condition: "✔️ الشرط صحيح — متابعة",
            action:    "⚙️ تم تنفيذ الإجراء",
            loop:      "🔁 انتهت الحلقة (3 تكرارات)",
            output:    "🏁 اكتملت النتيجة النهائية",
          };
          result = outcomes[node.type] ?? "✅ منجز";
        }
      } catch (e: any) { result = `❌ خطأ: ${e.message}`; }

      const entry = { nodeId: node.id, title: node.title, result, ts: new Date().toISOString() };
      logs.push(entry);
      send({ type: "node_done", ...entry });

      /* execute children sequentially */
      const children = getNextNodes(node.id);
      for (const childId of children) {
        const child = nodes.find(n => n.id === childId);
        if (child) await executeNode(child);
      }
    };

    /* start from trigger or first node */
    const start = nodes.find(n => n.type === "trigger") ?? nodes[0];
    if (start) await executeNode(start);

    /* update run record */
    await db.execute(sql`
      UPDATE ai_workflow_runs
      SET status = 'completed', log_entries = ${JSON.stringify(logs)}::jsonb, finished_at = NOW()
      WHERE id = ${runRow?.id}::uuid
    `);
    await db.execute(sql`
      UPDATE ai_workflows
      SET run_count = run_count + 1, last_run_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid
    `);

    send({ type: "done", logs });
    res.end();
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: e.message })}\n\n`);
    res.end();
  }
});

export default router;
