/**
 * Legal OS Routes — 3 endpoints
 */
import { Router } from "express";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import { getKernelSnapshot } from "../os/legal.os.kernel";

const router = Router();

/* ── GET /legal-os/snapshot ── اللقطة الكاملة ── */
router.get("/legal-os/snapshot", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const snapshot = await getKernelSnapshot(officeId);
    res.json(snapshot);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /legal-os/processes ── العمليات النشطة ── */
router.get("/legal-os/processes", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const snapshot = await getKernelSnapshot(officeId);
    res.json({ processes: snapshot.processes, total: snapshot.processes.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /legal-os/health ── الصحة العامة (public للـ monitoring) ── */
router.get("/legal-os/health", async (_req, res) => {
  try {
    const snapshot = await getKernelSnapshot();
    res.json({
      score:  snapshot.healthScore,
      mode:   snapshot.systemMode,
      layers: snapshot.layers.map(l => ({ id: l.id, status: l.status })),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
