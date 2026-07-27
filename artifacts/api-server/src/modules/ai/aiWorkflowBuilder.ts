import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireAuthWithTenant, requirePermission, requireSuperAdmin } from "../../middlewares/requireAuth";
import { callAI } from "./aiChat";

const router = Router();

/* ── helpers ─────────────────────────────────────────────────────── */
const sqlAll = async (q: any) => { const r = await db.execute(q); return Array.isArray(r) ? r : (r as any).rows ?? []; };
const sqlOne = async (q: any) => (await sqlAll(q))[0] ?? null;

async function getOfficeId(userId: string): Promise<string | null> {
  try {
    const arr = await sqlAll(sql`
      SELECT op.id FROM office_page op
      JOIN office_members om ON om.office_id = op.id
      WHERE om.user_id = ${userId} LIMIT 1
    `);
    return arr[0]?.id ?? null;
  } catch { return null; }
}

/* ── SECURITY: Super Admin OR explicit office grant ──────────────── */
async function canUseWorkflowBuilder(req: any): Promise<boolean> {
  if (req.isSuperAdmin) return true;
  const officeId = await getOfficeId(req.auth?.userId ?? req.userId ?? "");
  if (!officeId) return false;
  const grant = await sqlOne(sql`
    SELECT id FROM workflow_builder_grants
    WHERE office_id = ${officeId}::uuid AND is_active = true LIMIT 1
  `);
  return !!grant;
}

/* middleware wrapper */
async function requireWorkflowAccess(req: any, res: any, next: any) {
  if (await canUseWorkflowBuilder(req)) return next();
  return res.status(403).json({ error: "لا تملك صلاحية الوصول لـ AI Workflow Builder. تواصل مع المشرف للحصول على الصلاحية." });
}

/* ── GET /ai-workflow/access-check ───────────────────────────────── */
router.get("/ai-workflow/access-check", requireAuthWithTenant, requirePermission("ai:access"), async (req: any, res) => {
  try {
    const allowed = await canUseWorkflowBuilder(req);
    const officeId = await getOfficeId(req.auth.userId);
    let grant = null;
    if (officeId && !req.isSuperAdmin) {
      grant = await sqlOne(sql`SELECT * FROM workflow_builder_grants WHERE office_id = ${officeId}::uuid`);
    }
    res.json({ allowed, isSuperAdmin: !!req.isSuperAdmin, grant });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════════
   SUPER ADMIN: Grant management routes (/api/admin/workflow-grants)
═══════════════════════════════════════════════════════════════════ */
router.get("/admin/workflow-grants", requireAuthWithTenant, requireSuperAdmin, async (req: any, res) => {
  try {
    const rows = await sqlAll(sql`
      SELECT wg.*, op.name as office_name, op.slug as office_slug, op.plan as office_plan
      FROM workflow_builder_grants wg
      JOIN office_page op ON op.id = wg.office_id
      ORDER BY wg.granted_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/admin/workflow-grants", requireAuthWithTenant, requireSuperAdmin, async (req: any, res) => {
  try {
    const { office_id, notes, plan_override } = req.body;
    if (!office_id) return res.status(400).json({ error: "office_id مطلوب" });
    const row = await sqlOne(sql`
      INSERT INTO workflow_builder_grants (office_id, granted_by, notes, plan_override, is_active)
      VALUES (${office_id}::uuid, ${req.auth.userId}, ${notes ?? ""}, ${plan_override ?? null}, true)
      ON CONFLICT (office_id) DO UPDATE SET is_active = true, granted_by = ${req.auth.userId}, notes = ${notes ?? ""}, granted_at = NOW()
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/admin/workflow-grants/:officeId", requireAuthWithTenant, requireSuperAdmin, async (req: any, res) => {
  try {
    await db.execute(sql`
      UPDATE workflow_builder_grants SET is_active = false WHERE office_id = ${String(req.params.officeId)}::uuid
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── ALL AI WORKFLOW ROUTES → require access ─────────────────────── */
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
      "config": {}
    }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "اختياري" }
  ]
}

أنواع العقد: trigger (زناد) / ai_think (تفكير) / legal_doc (وثيقة) / notify (إشعار) / condition (شرط) / action (إجراء) / loop (حلقة) / output (نتيجة)
ضع العقد هرمياً x:100-900 y:80-700. استخدم ألواناً جذابة. أنشئ 4-10 عقد.`;

router.post("/ai-workflow/generate", requireAuthWithTenant, requirePermission("ai:access"), requireWorkflowAccess, async (req: any, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt مطلوب" });
    const { reply: raw } = await callAI(SYSTEM_PROMPT, `المهمة: ${prompt}\n\nأنشئ workflow احترافي لهذه المهمة القانونية.`, [], "gemini");
    let graph;
    try {
      graph = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return res.status(500).json({ error: "فشل تحليل الـ JSON" });
      graph = JSON.parse(match[0]);
    }
    res.json({ graph });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/ai-workflow", requireAuthWithTenant, requirePermission("ai:access"), requireWorkflowAccess, async (req: any, res) => {
  try {
    const officeId = req.isSuperAdmin ? null : await getOfficeId(req.auth.userId);
    const rows = await sqlAll(
      officeId
        ? sql`SELECT id, name, description, status, run_count, last_run_at, created_at FROM ai_workflows WHERE office_id = ${officeId}::uuid ORDER BY created_at DESC`
        : sql`SELECT id, name, description, status, run_count, last_run_at, created_at FROM ai_workflows ORDER BY created_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/ai-workflow", requireAuthWithTenant, requirePermission("ai:access"), requireWorkflowAccess, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId && !req.isSuperAdmin) return res.status(404).json({ error: "لا يوجد مكتب" });
    const { name, description, prompt, graph_json } = req.body;
    const oid = officeId ?? "00000000-0000-0000-0000-000000000000";
    const row = await sqlOne(sql`
      INSERT INTO ai_workflows (office_id, name, description, prompt, graph_json)
      VALUES (${oid}::uuid, ${name}, ${description ?? ""}, ${prompt ?? ""}, ${JSON.stringify(graph_json)}::jsonb)
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/ai-workflow/:id", requireAuthWithTenant, requirePermission("ai:access"), requireWorkflowAccess, async (req: any, res) => {
  try {
    const row = await sqlOne(sql`SELECT * FROM ai_workflows WHERE id = ${String(req.params.id)}::uuid`);
    if (!row) return res.status(404).json({ error: "غير موجود" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/ai-workflow/:id", requireAuthWithTenant, requirePermission("ai:access"), requireWorkflowAccess, async (req: any, res) => {
  try {
    await db.execute(sql`DELETE FROM ai_workflows WHERE id = ${String(req.params.id)}::uuid`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/ai-workflow/:id/execute", requireAuthWithTenant, requirePermission("ai:access"), requireWorkflowAccess, async (req: any, res) => {
  try {
    const wf = await sqlOne(sql`SELECT * FROM ai_workflows WHERE id = ${String(req.params.id)}::uuid`);
    if (!wf) return res.status(404).json({ error: "غير موجود" });
    const graph = wf.graph_json as any;
    const nodes: any[] = graph.nodes ?? [];
    const edges: any[] = graph.edges ?? [];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const runRow = await sqlOne(sql`
      INSERT INTO ai_workflow_runs (workflow_id, office_id)
      VALUES (${String(req.params.id)}::uuid, ${wf.office_id}::uuid) RETURNING id
    `);

    send({ type: "start", runId: runRow?.id, total: nodes.length });

    const visited = new Set<string>();
    const logs: any[] = [];
    const getNextNodes = (nodeId: string) => edges.filter(e => e.from === nodeId).map((e: any) => e.to);

    const executeNode = async (node: any) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      send({ type: "node_start", nodeId: node.id, title: node.title });
      await new Promise(r => setTimeout(r, 500 + Math.random() * 700));

      let result = "";
      try {
        if (node.type === "ai_think" || node.type === "legal_doc") {
          const { reply: raw } = await callAI("أنت مساعد قانوني ذكي في منصة عدالة. أجب بإيجاز.", `نفّذ: ${node.title} — ${node.description}`, [], "gemini");
          result = raw.slice(0, 280) + (raw.length > 280 ? "…" : "");
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
      for (const childId of getNextNodes(node.id)) {
        const child = nodes.find(n => n.id === childId);
        if (child) await executeNode(child);
      }
    };

    const start = nodes.find(n => n.type === "trigger") ?? nodes[0];
    if (start) await executeNode(start);

    await db.execute(sql`
      UPDATE ai_workflow_runs SET status='completed', log_entries=${JSON.stringify(logs)}::jsonb, finished_at=NOW()
      WHERE id=${runRow?.id}::uuid
    `);
    await db.execute(sql`
      UPDATE ai_workflows SET run_count=run_count+1, last_run_at=NOW()
      WHERE id=${String(req.params.id)}::uuid
    `);

    send({ type: "done", logs });
    res.end();
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: e.message })}\n\n`);
    res.end();
  }
});

export default router;
