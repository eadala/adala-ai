import { requireAuthWithTenant, checkIsSuperAdmin} from "../../middlewares/requireAuth";
import { resolveTenantId } from "../../middlewares/tenantMiddleware";
import { insertForResolvedOffice } from "../../lib/messagesTenantGate";
import { Router } from "express";
import { db, messagesTable, casesTable } from "@workspace/db";
import { ListMessagesQueryParams, SendMessageBody } from "@workspace/api-zod";
import { getAuth, createClerkClient } from "@clerk/express";
import { sql, eq } from "drizzle-orm";
import {
  MAX_PAGE_LIMIT,
  parsePageLimit,
  queryHasPageAndLimit,
} from "../../lib/paginationSafety";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- pre-existing lint debt in message helpers; pagination touch-up */

const router = Router();

// ── Auth + comm-perm helper (mirrors client-portal.ts) ───────────────────────
let _clerkMsg: ReturnType<typeof createClerkClient> | null = null;
const getClerkMsg = () => {
  if (!_clerkMsg) _clerkMsg = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerkMsg;
};
/**
 * Resolves the acting user + their office role, for the message-reply
 * permission check only. officeId is ALWAYS derived via the canonical
 * resolveTenantId() (membership-validated) — it must NEVER fall back to the
 * Clerk user id. Returns null (fail closed) when no tenant can be resolved,
 * exactly like the platform's other tenant-aware routes.
 */
async function getMsgUser(req: any) {
  const auth = getAuth(req);
  if (!auth?.userId) return null;
  try {
    const user = await getClerkMsg().users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const isSA = await checkIsSuperAdmin(auth.userId);
    const headerTenant = req.headers?.["x-tenant-id"] as string | undefined;
    const officeId = await resolveTenantId(auth.userId, headerTenant);
    if (!officeId) return null; // fail closed — never substitute auth.userId
    const rows = await db.execute(sql`SELECT role FROM office_members WHERE user_id=${auth.userId} AND office_id=${officeId} AND status='active' LIMIT 1`);
    const rowArr = Array.isArray(rows) ? rows : ((rows as any)?.rows ?? []);
    const officeRole: string = rowArr[0]?.role ?? (user.publicMetadata?.role as string) ?? "lawyer";
    const isAdmin = isSA || officeRole === "firm_owner" || officeRole === "office_manager";
    return { userId: auth.userId, officeId, email, isSA, officeRole, isAdmin };
  } catch { return null; }
}
const DEFAULT_REPLY_ROLES = ["firm_owner", "office_manager", "lawyer", "secretary"];
async function canReplyToClient(u: NonNullable<Awaited<ReturnType<typeof getMsgUser>>>): Promise<boolean> {
  if (u.isAdmin || u.isSA) return true;
  try {
    const rows = await db.execute(sql`SELECT reply_roles FROM client_comm_settings WHERE office_id=${u.officeId}`);
    const arr = Array.isArray(rows) ? rows : ((rows as any)?.rows ?? []);
    const allowed: string[] = arr[0]?.reply_roles ?? DEFAULT_REPLY_ROLES;
    return allowed.includes(u.officeRole);
  } catch { return DEFAULT_REPLY_ROLES.includes(u.officeRole); }
}

function sqlRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}

// ── GET /messages/conversations  — grouped view ───────────────────────────────
router.get("/messages/conversations", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    /*
     * Soft-cap: load the newest MAX_PAGE_LIMIT messages for this office, then
     * group. Full historical grouping required unbounded load and is not
     * suitable for page/limit without a different conversation model.
     */
    const msgs = sqlRows(await db.execute(sql`
      SELECT * FROM (
        SELECT * FROM messages
        WHERE office_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT ${MAX_PAGE_LIMIT}
      ) recent
      ORDER BY created_at ASC
    `));

    const caseIds = [...new Set(msgs.map((m: any) => m.caseId ?? m.case_id).filter(Boolean))] as string[];
    const allCases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable)
        .where(eq((casesTable as any).officeId, tenantId))
      : [];
    const caseMap = Object.fromEntries(allCases.map((c) => [c.id, c.title]));

    const groups: Record<string, any[]> = {};
    for (const m of msgs) {
      const key = (m.caseId ?? m.case_id) ?? "__direct__";
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    const conversations = Object.entries(groups).map(([key, messages]) => {
      const lastMsg = messages[messages.length - 1];
      const unread = messages.filter((m: any) => m.direction === "inbound" && m.status !== "read").length;
      const name = key === "__direct__" ? "مراسلات مباشرة" : (caseMap[key] ?? `قضية ${key.slice(0, 8)}`);
      const createdAt = lastMsg.createdAt ?? lastMsg.created_at;
      return {
        id: key,
        caseId: key === "__direct__" ? null : key,
        name,
        channel: lastMsg.channel ?? "internal",
        lastMsg: lastMsg.content,
        time: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
        unread,
        starred: false,
        online: false,
        caseRef: key !== "__direct__" ? key.slice(0, 8).toUpperCase() : undefined,
        messages: messages.map((m: any) => {
          const t = m.createdAt ?? m.created_at;
          return {
            id: m.id,
            from: m.direction === "inbound" ? "client" : "me",
            content: m.content,
            time: t instanceof Date ? t.toISOString() : String(t),
            status: m.status ?? undefined,
            channel: m.channel ?? "internal",
          };
        }),
      };
    });

    res.json(conversations);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /messages  — flat list ────────────────────────────────────────────────
router.get("/messages", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const query = ListMessagesQueryParams.parse(req.query);
    const paginated = queryHasPageAndLimit(req.query);
    const { page, limit, offset } = paginated
      ? parsePageLimit(req.query, 50)
      : { page: 1, limit: MAX_PAGE_LIMIT, offset: 0 };

    const caseCond = query.caseId ? sql`AND case_id = ${query.caseId}` : sql``;
    const channelCond = query.channel ? sql`AND channel = ${query.channel}` : sql``;

    const msgs = sqlRows(await db.execute(sql`
      SELECT * FROM messages
      WHERE office_id = ${tenantId}
      ${caseCond} ${channelCond}
      ORDER BY created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `));

    const caseIds = [...new Set(msgs.map((m: any) => m.caseId ?? m.case_id).filter(Boolean))] as string[];
    const cases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable)
        .where(eq((casesTable as any).officeId, tenantId))
      : [];
    const caseMap = Object.fromEntries(cases.map((c) => [c.id, c.title]));

    const mapped = msgs.map((m: any) => {
      const caseId = m.caseId ?? m.case_id ?? null;
      const createdAt = m.createdAt ?? m.created_at;
      return {
        id: m.id,
        caseId,
        caseName: caseId ? (caseMap[caseId] ?? null) : null,
        channel: m.channel,
        direction: m.direction,
        content: m.content,
        status: m.status,
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
      };
    });

    if (!paginated) {
      res.json(mapped);
      return;
    }

    const total = Number(sqlRows(await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM messages
      WHERE office_id = ${tenantId}
      ${caseCond} ${channelCond}
    `))[0]?.total ?? 0);

    res.json({
      data: mapped,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// requireAuthWithTenant: resolves + requires a canonical tenant (via
// resolveTenantId) before the handler runs, and rejects with 403 when no
// tenant can be resolved — never substitutes the Clerk user id.
router.post("/messages", requireAuthWithTenant, async (req, res) => {
  // Outbound messages (to clients) require reply permission
  const u = await getMsgUser(req);
  if (!u) { res.status(401).json({ error: "يجب تسجيل الدخول لإرسال رسائل" }); return; }
  if (!await canReplyToClient(u)) {
    res.status(403).json({
      error: "ليس لديك صلاحية الرد على العملاء — تواصل مع مدير المكتب لمنحك الصلاحية",
      code: "NO_REPLY_PERM",
    }); return;
  }
  try {
    const body = SendMessageBody.parse(req.body);
    const headerTenant = req.headers["x-tenant-id"] as string | undefined;
    /*
     * insertForResolvedOffice re-verifies (fail-closed) that a canonical
     * tenant resolves immediately before the insert — the insert callback
     * below is NEVER invoked when it does not, independent of the
     * requireAuthWithTenant check above.
     *
     * CONFIRMED (out of scope for this fix): messagesTable (Drizzle schema
     * lib/db/src/schema/messages.ts) has no officeId/office_id column, and no
     * migration adds one — persisting the resolved officeId on the row would
     * fail at runtime and requires a schema migration (out of scope here;
     * see PR description). The resolved officeId is intentionally unused
     * below for that reason — it is still returned so it can be persisted
     * once the column exists.
     */
    const created = await insertForResolvedOffice(
      { userId: u.userId, headerTenant },
      async () => {
        const [row] = await db.insert(messagesTable).values({
          caseId: body.caseId ?? null,
          channel: body.channel,
          direction: "outbound",
          content: body.content,
          status: "sent",
        }).returning();
        return row;
      },
      { resolveTenantId },
    );
    if (!created) {
      res.status(403).json({
        error: "لا يمكن تحديد المكتب. تأكد من اكتمال إعداد الحساب.",
        code: "TNT_403",
      });
      return;
    }
    res.status(201).json({ ...created, caseName: null, createdAt: created.createdAt.toISOString() });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "خطأ في إرسال الرسالة" });
  }
});

export default router;
