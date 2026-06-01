import { Router } from "express";
import { db, invoicesTable, subscriptionsTable, usageLogsTable } from "@workspace/db";

const router = Router();

router.get("/billing/invoices", async (req, res) => {
  try {
    const invoices = await db.select().from(invoicesTable).orderBy(invoicesTable.createdAt);
    res.json(invoices.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/billing/subscription", async (req, res) => {
  try {
    const [sub] = await db.select().from(subscriptionsTable).limit(1);
    if (!sub) return res.status(404).json({ error: "No subscription found" });
    res.json({
      ...sub,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate.toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/billing/usage", async (req, res) => {
  try {
    const logs = await db.select().from(usageLogsTable).orderBy(usageLogsTable.createdAt);
    res.json(logs.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
