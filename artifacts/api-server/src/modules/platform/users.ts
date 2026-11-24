/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; pagination touch-up */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql, asc, and } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import {
  MAX_PAGE_LIMIT,
  parsePageLimit,
  queryHasPageAndLimit,
} from "../../lib/paginationSafety";

const router = Router();

router.get("/users", requireAuthWithTenant, async (req, res) => {
  try {
    const paginated = queryHasPageAndLimit(req.query);
    const { page, limit, offset } = paginated
      ? parsePageLimit(req.query, 50)
      : { page: 1, limit: MAX_PAGE_LIMIT, offset: 0 };
    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : null;

    const searchCond = search
      ? sql`(
          COALESCE(${usersTable.fullName}, '') ILIKE ${"%" + search + "%"}
          OR COALESCE(${usersTable.email}, '') ILIKE ${"%" + search + "%"}
        )`
      : sql`true`;

    const where = and(searchCond);

    /*
     * NOTE (tracked separately — do not fix here):
     * GET /api/users has no office_id / tenant filter and no GET-specific
     * requirePermission check. Pre-existing authorization gap.
     */
    const [users, aggRow] = await Promise.all([
      db.select().from(usersTable)
        .where(where)
        .orderBy(asc(usersTable.createdAt))
        .limit(limit)
        .offset(offset),
      /* Same search/visibility predicates as the list; active is full-dataset. */
      db.select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) FILTER (WHERE ${usersTable.status} = 'active')::int`,
      }).from(usersTable).where(where)
        .then((rows) => rows[0]),
    ]);

    const mapped = users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

    if (!paginated) {
      res.json(mapped);
      return;
    }

    const total = Number(aggRow?.total ?? 0);
    const active = Number(aggRow?.active ?? 0);
    res.json({
      data: mapped,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: { active },
    });
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
