import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/clients", async (_req, res) => {
  const clients = await db.select().from(clientsTable).orderBy(desc(clientsTable.createdAt));
  res.json(clients);
});

router.post("/clients", async (req, res) => {
  const [client] = await db.insert(clientsTable).values(req.body).returning();
  res.json(client);
});

router.patch("/clients/:id", async (req, res) => {
  const [updated] = await db.update(clientsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(clientsTable.id, req.params.id)).returning();
  res.json(updated);
});

router.delete("/clients/:id", async (req, res) => {
  await db.delete(clientsTable).where(eq(clientsTable.id, req.params.id));
  res.json({ success: true });
});

router.get("/clients/stats", async (_req, res) => {
  const all = await db.select().from(clientsTable);
  res.json({
    total: all.length,
    active: all.filter(c => c.status === "active").length,
    potential: all.filter(c => c.status === "potential").length,
    companies: all.filter(c => c.type === "company").length,
    individuals: all.filter(c => c.type === "individual").length,
  });
});

export default router;
