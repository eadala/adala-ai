import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";

const router = Router();

router.get("/users", requireAuthWithTenant, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/users", requireAuthWithTenant, async (req, res) => {
  try {
    const body = CreateUserBody.parse(req.body);
    const [created] = await db.insert(usersTable).values({
      email: body.email,
      fullName: body.fullName,
      phone: body.phone ?? null,
      status: body.status ?? "active",
      role: body.role,
    }).returning();
    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/users/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const body = UpdateUserBody.parse(req.body);
    const [updated] = await db.update(usersTable).set({
      ...(body.fullName !== undefined && { fullName: body.fullName }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.role !== undefined && { role: body.role }),
      ...(body.status !== undefined && { status: body.status }),
    }).where(eq(usersTable.id, String(req.params.id))).returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/users/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, String(req.params.id)));
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
