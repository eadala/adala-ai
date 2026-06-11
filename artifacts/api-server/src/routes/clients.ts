/**
 * Clients routes — fixed:
 *  1. Auth (getAuth) added to all routes
 *  2. req.body spread replaced with explicit field extraction
 *  3. try/catch added throughout
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

function requireAuth(req: any, res: any): string | null {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return null; }
  return userId;
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
      name, type = "individual", email, phone, nationalId,
      company, address, notes, status = "active", caseIds,
    } = req.body as {
      name: string; type?: string; email?: string; phone?: string;
      nationalId?: string; company?: string; address?: string;
      notes?: string; status?: string; caseIds?: string[];
    };
    if (!name) return res.status(400).json({ error: "اسم الموكل مطلوب" });

    const [client] = await db.insert(clientsTable).values({
      name, type, email: email ?? null, phone: phone ?? null,
      nationalId: nationalId ?? null, company: company ?? null,
      address: address ?? null, notes: notes ?? null,
      status, caseIds: caseIds ?? [],
    }).returning();
    res.json(client);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const { name, type, email, phone, nationalId, company, address, notes, status } = req.body;
    const [updated] = await db.update(clientsTable)
      .set({
        ...(name       !== undefined && { name }),
        ...(type       !== undefined && { type }),
        ...(email      !== undefined && { email }),
        ...(phone      !== undefined && { phone }),
        ...(nationalId !== undefined && { nationalId }),
        ...(company    !== undefined && { company }),
        ...(address    !== undefined && { address }),
        ...(notes      !== undefined && { notes }),
        ...(status     !== undefined && { status }),
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
