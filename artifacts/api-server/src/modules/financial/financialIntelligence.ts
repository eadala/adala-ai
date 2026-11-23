import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
/**
 * Financial Intelligence API
 * GET /api/finance/intelligence  — unified KPIs + insights + forecast
 * GET /api/finance/trend         — monthly revenue/expenses trend
 * GET /api/finance/categories    — revenue by category
 */
import { Router } from "express";
import { getUnifiedFinancialAI } from "../../services/financialIntelligence";
import { getAuth } from "@clerk/express";

const router = Router();

router.get("/finance/intelligence", requireAuthWithTenant, async (req, res) => {
  const { userId } = getAuth(req as any);
  if (!userId) return res.status(401).json({ error: "غير مصرح" });

  try {
    const data = await getUnifiedFinancialAI();
    res.json({ system: "ADALA_AI_FINANCE_CORE", ...data });
  } catch (err: any) {
        res.status(500).json({ error: err.message });
  }
});

export default router;
