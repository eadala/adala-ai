/**
 * Production Hardening Routes — 8 endpoints (super_admin only)
 */
import { Router } from "express";
import { requireAuthWithTenant, requireSuperAdmin} from "../../middlewares/requireAuth";
import {
  getSystemState, setSystemMode, setAiLock, isAiLocked,
  IMMUTABLE_MODULES, changeGate, loadHardeningState,
} from "../../hardening/production.lock";
import { runFinancialGuard }    from "../../hardening/financial.guard";
import { runValidationPipeline } from "../../hardening/validation.pipeline";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ── GET /hardening/status ── حالة النظام الكاملة ── */
router.get("/hardening/status", requireSuperAdmin, async (_req, res) => {
  try {
    await loadHardeningState();
    const state = getSystemState();
    const financial = await runFinancialGuard();
    res.json({
      ...state,
      aiLocked:       isAiLocked(),
      financial:      { score: financial.score, allPassed: financial.allPassed },
      immutableCount: IMMUTABLE_MODULES.length,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /hardening/safe-mode ── تفعيل/إلغاء الوضع الآمن ── */
router.post("/hardening/safe-mode", requireSuperAdmin, async (req, res) => {
  try {
    const { activate, reason } = req.body as { activate: boolean; reason?: string };
    const userId = (req as any).userId ?? "super_admin";
    const mode   = activate ? "safe_mode" : "stable";
    await setSystemMode(mode, reason ?? (activate ? "تم التفعيل يدوياً" : "تم الإلغاء يدوياً"), userId);
    res.json({ ok: true, mode, reason });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /hardening/ai-lock ── قفل / فتح تنفيذ الذكاء الاصطناعي ── */
router.post("/hardening/ai-lock", requireSuperAdmin, (req, res) => {
  const { locked } = req.body as { locked: boolean };
  setAiLock(locked);
  res.json({ ok: true, aiLocked: isAiLocked() });
});

/* ── GET /hardening/modules ── قائمة الوحدات المحمية ── */
router.get("/hardening/modules", requireSuperAdmin, (_req, res) => {
  res.json({ modules: IMMUTABLE_MODULES });
});

/* ── POST /hardening/change-gate ── تسجيل تغيير ── */
router.post("/hardening/change-gate", requireSuperAdmin, async (req, res) => {
  try {
    const { type, affects, description } = req.body;
    const userId  = (req as any).userId ?? "super_admin";
    const result  = await changeGate({ type, affects: affects ?? [], description, requestedBy: userId });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /hardening/change-log ── سجل التغييرات ── */
router.get("/hardening/change-log", requireSuperAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows  = await db.execute(sql`
      SELECT id, change_type, affects, description, risk_level,
             requires_approval, approved, created_by, created_at
      FROM change_log ORDER BY created_at DESC LIMIT ${limit}
    `);
    res.json({ log: rows.rows ?? rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /hardening/financial ── تقرير سلامة المالية ── */
router.get("/hardening/financial", requireSuperAdmin, async (_req, res) => {
  try {
    const report = await runFinancialGuard();
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /hardening/validate ── خط التحقق الكامل ── */
router.post("/hardening/validate", requireSuperAdmin, async (_req, res) => {
  try {
    const result = await runValidationPipeline();
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
