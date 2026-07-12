import { requireAuthWithTenant, requirePermission } from "../../middlewares/requireAuth";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { orchestrate } from "../../copilot/legal.orchestrator";
import { analyzeCaseIntelligence } from "../../copilot/case.intelligence";
import { rememberFact, recallMemory } from "../../copilot/memory";
import {
  getRequiredTenantId,
  tenantRequiredResponse,
  TenantRequiredError,
} from "../../core/tenantContext";
import { detectIntent } from "../../copilot/intent.engine";

const router = Router();

function getIds(req: Request) {
  const userId = (req as any).userId ?? (req as any).auth?.userId;
  const officeId = getRequiredTenantId(req);
  return { userId, officeId };
}

function handleTenantError(err: unknown, res: Response): boolean {
  if (err instanceof TenantRequiredError) {
    res.status(403).json(tenantRequiredResponse());
    return true;
  }
  return false;
}

/* ── POST /api/copilot/chat ── Legal Orchestrator v2 ── */
router.post("/chat", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const { message, history = [], pageContext = "" } = req.body as {
      message: string;
      history: { role: string; content: string }[];
      pageContext?: string;
    };
    if (!message?.trim()) { res.status(400).json({ error: "الرسالة مطلوبة" }); return; }

    const { userId, officeId } = getIds(req);
    const result = await orchestrate(message, history, userId, officeId, pageContext);

    try {
      await db.execute(sql`
        INSERT INTO ai_assistant_logs (user_id, question, response, context_used)
        VALUES (${userId}, ${message}, ${result.reply}, ${"copilot_v2:" + result.intent})
      `);
    } catch {}

    res.json({
      reply:        result.reply,
      action:       result.action ?? null,
      intent:       result.intent,
      confidence:   result.confidence,
      intelligence: result.intelligence ?? null,
      toolUsed:     result.toolUsed ?? null,
    });
  } catch (e: any) {
    if (handleTenantError(e, res)) return;
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/copilot/snapshot ── */
router.get("/snapshot", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const officeId = getRequiredTenantId(req);

    const safeCount = async (query: ReturnType<typeof sql>): Promise<number> => {
      try { const r = await db.execute(query); return Number((r.rows[0] as any)?.count ?? (r.rows[0] as any)?.active ?? (r.rows[0] as any)?.overdue ?? (r.rows[0] as any)?.upcoming ?? (r.rows[0] as any)?.pending ?? 0); } catch { return 0; }
    };

    const [activeCases, overdueInvoices, upcomingEvents, pendingTasks] = await Promise.all([
      safeCount(sql`SELECT COUNT(*) FILTER (WHERE status IN ('open','in_progress')) as active FROM cases WHERE office_id=${officeId}`),
      safeCount(sql`SELECT COUNT(*) FILTER (WHERE status='overdue') as overdue FROM client_invoices WHERE office_id=${officeId}`),
      safeCount(sql`SELECT COUNT(*) as upcoming FROM events e JOIN cases c ON c.id=e.case_id WHERE c.office_id=${officeId} AND e.start_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'`),
      safeCount(sql`SELECT COUNT(*) as pending FROM tasks WHERE office_id=${officeId} AND status != 'done'`),
    ]);
    res.json({ activeCases, overdueInvoices, upcomingEvents, pendingTasks });
  } catch (e: any) {
    if (handleTenantError(e, res)) return;
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/copilot/intelligence/:caseId ── */
router.get("/intelligence/:caseId", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const caseId  = String(req.params.caseId);
    const { officeId } = getIds(req);
    const intel   = await analyzeCaseIntelligence(caseId, officeId);
    res.json(intel);
  } catch (e: any) {
    if (handleTenantError(e, res)) return;
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /api/copilot/intent ── */
router.post("/intent", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const { message } = req.body ?? {};
    if (!message) { res.status(400).json({ error: "message required" }); return; }
    const intent = await detectIntent(String(message));
    res.json(intent);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/copilot/memory ── */
router.get("/memory", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const { userId, officeId } = getIds(req);
    const mem = await recallMemory(userId, officeId);
    res.json({ memory: mem });
  } catch (e: any) {
    if (handleTenantError(e, res)) return;
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /api/copilot/memory ── */
router.post("/memory", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const { userId, officeId } = getIds(req);
    const { type = "preference", key, value } = req.body ?? {};
    if (!key || !value) { res.status(400).json({ error: "key and value required" }); return; }
    await rememberFact(userId, officeId, type, String(key), String(value));
    res.json({ ok: true });
  } catch (e: any) {
    if (handleTenantError(e, res)) return;
    res.status(500).json({ error: e.message });
  }
});

export default router;
