import { Router } from "express";
import { randomUUID } from "crypto";
import { requireAuthWithTenant } from "../../../middlewares/requireAuth";
import { aiTenantGuard } from "./middleware/ai-tenant-guard";
import { aiOrchestrator } from "./orchestrator";
import { IsolatedMemory } from "./memory/isolated-memory";
import { generateDailyReport, computeOfficeHealth, runAutonomousForAllOffices } from "./autonomous";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { AIAgentType } from "./types";

const router = Router();

function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

/* ── POST /api/cc/chat/:agentType — main chat ──────────────────────────── */
router.post(
  "/cc/chat/:agentType",
  requireAuthWithTenant,
  aiTenantGuard,
  async (req, res) => {
    const agentType = req.params.agentType as AIAgentType;
    const officeId  = (req as any).tenantId as string;
    const userId    = (req as any).userId   as string;
    const { message, sessionId, history = [], model = "auto" } = req.body ?? {};

    if (!message?.trim()) {
      res.status(400).json({ error: "الرسالة مطلوبة" }); return;
    }

    try {
      const result = await aiOrchestrator({
        officeId, userId,
        role: (req as any).role ?? "member",
        message, agentType, sessionId, history, model,
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
);

/* ── POST /api/cc/auto-route — intent-based routing ───────────────────── */
router.post(
  "/cc/auto-route",
  requireAuthWithTenant,
  aiTenantGuard,
  async (req, res) => {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).userId   as string;
    const { message, sessionId, history = [], model = "auto" } = req.body ?? {};

    if (!message?.trim()) { res.status(400).json({ error: "الرسالة مطلوبة" }); return; }

    try {
      const result = await aiOrchestrator({
        officeId, userId, role: (req as any).role ?? "member",
        message, sessionId, history, model,
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
);

/* ── GET /api/cc/sessions — list sessions ─────────────────────────────── */
router.get("/cc/sessions", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const userId   = (req as any).userId   as string;
  try {
    const r = await db.execute(sql`
      SELECT id, agent_type, title, updated_at
      FROM ai_command_sessions
      WHERE office_id = ${officeId} AND user_id = ${userId}
      ORDER BY updated_at DESC LIMIT 30
    `);
    res.json(rows(r));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/cc/sessions/:id ─────────────────────────────────────────── */
router.get("/cc/sessions/:id", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const sessionId = String(req.params.id);
  try {
    const msgs = await IsolatedMemory.loadSession(officeId, sessionId);
    res.json({ sessionId, messages: msgs });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── DELETE /api/cc/sessions/:id ──────────────────────────────────────── */
router.delete("/cc/sessions/:id", requireAuthWithTenant, async (req, res) => {
  const officeId  = (req as any).tenantId as string;
  const sessionId = String(req.params.id);
  IsolatedMemory.clear(officeId, sessionId);
  await db.execute(sql`
    DELETE FROM ai_command_sessions WHERE id = ${sessionId} AND office_id = ${officeId}
  `).catch(() => {});
  res.json({ success: true });
});

/* ── GET /api/cc/health — office health score ─────────────────────────── */
router.get("/cc/health", requireAuthWithTenant, aiTenantGuard, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  try {
    const health = await computeOfficeHealth(officeId);
    res.json(health);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/cc/daily-report ─────────────────────────────────────────── */
router.get("/cc/daily-report", requireAuthWithTenant, aiTenantGuard, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  try {
    const report = await generateDailyReport(officeId);
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /api/cc/autonomous/run — super-admin trigger ───────────────── */
router.post("/cc/autonomous/run", requireAuthWithTenant, async (req, res) => {
  if (!(req as any).isSuperAdmin) { res.status(403).json({ error: "super admin only" }); return; }
  try {
    runAutonomousForAllOffices().catch(() => {});
    res.json({ started: true, message: "Autonomous layer running in background" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
