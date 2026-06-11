/**
 * Clients routes — fixed:
 *  1. Auth (getAuth) added to all write routes
 *  2. req.body spread replaced with explicit field extraction
 *  3. Fields aligned with actual DB schema (fullName, no address/caseIds)
 *  4. try/catch added throughout
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

function requireAuth(req: any, res: any): boolean {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return false; }
  return true;
}

router.get("/clients", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const clients = await db.select().from(clientsTable).orderBy(desc(clientsTable.createdAt));
    res.json(clients);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/clients", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const {
      fullName, type = "individual", email, phone,
      nationalId, company, notes, status = "active", source, tags,
    } = req.body as {
      fullName: string; type?: string; email?: string; phone?: string;
      nationalId?: string; company?: string; notes?: string;
      status?: string; source?: string; tags?: string[];
    };
    if (!fullName) return res.status(400).json({ error: "اسم الموكل مطلوب" });

    const [client] = await db.insert(clientsTable).values({
      fullName, type,
      email:      email      ?? null,
      phone:      phone      ?? null,
      nationalId: nationalId ?? null,
      company:    company    ?? null,
      notes:      notes      ?? null,
      status,
      source:     source     ?? "direct",
      tags:       tags       ?? [],
    }).returning();
    res.json(client);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const { fullName, type, email, phone, nationalId, company, notes, status, source, tags } = req.body;
    const [updated] = await db.update(clientsTable)
      .set({
        ...(fullName   !== undefined && { fullName }),
        ...(type       !== undefined && { type }),
        ...(email      !== undefined && { email }),
        ...(phone      !== undefined && { phone }),
        ...(nationalId !== undefined && { nationalId }),
        ...(company    !== undefined && { company }),
        ...(notes      !== undefined && { notes }),
        ...(status     !== undefined && { status }),
        ...(source     !== undefined && { source }),
        ...(tags       !== undefined && { tags }),
        updatedAt: new Date(),
      })
      .where(eq(clientsTable.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "الموكل غير موجود" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/clients/:id", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    await db.delete(clientsTable).where(eq(clientsTable.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/clients/stats", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const all = await db.select().from(clientsTable);
    res.json({
      total:       all.length,
      active:      all.filter(c => c.status === "active").length,
      potential:   all.filter(c => c.status === "potential").length,
      companies:   all.filter(c => c.type   === "company").length,
      individuals: all.filter(c => c.type   === "individual").length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
