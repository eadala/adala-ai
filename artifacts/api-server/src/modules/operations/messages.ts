/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unused-vars -- pre-existing lint debt; tenant fallback removal */
import { requireAuthWithTenant, requireSuperAdmin, checkIsSuperAdmin} from "../../middlewares/requireAuth";
import { resolveTenantId } from "../../middlewares/tenantMiddleware";
import { Router } from "express";
import { db, messagesTable, casesTable } from "@workspace/db";
import { ListMessagesQueryParams, SendMessageBody } from "@workspace/api-zod";
import { getAuth, createClerkClient } from "@clerk/express";
import { sql } from "drizzle-orm";

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

// ── GET /messages/conversations  — grouped view ───────────────────────────────
router.get("/messages/conversations", requireAuthWithTenant, async (req, res) => {
  try {
    // Office scope comes ONLY from req.tenantId (requireAuthWithTenant) —
    // a helper-returned officeId must never override the canonical tenant.
    const tenantId = (req as any).tenantId as string;
    /*
     * CONFIRMED (out of scope for this fix): the `messages` table has no
     * `office_id` column in any migration or the Drizzle schema
     * (lib/db/src/schema/messages.ts) — this WHERE clause already targets a
     * column that does not exist. That is a pre-existing schema gap,
     * unrelated to the userId-as-tenant fallback removed here; fixing it
     * requires a migration and is intentionally not addressed in this PR.
     */
    const msgs = await db.execute(sql`SELECT * FROM messages WHERE office_id=${tenantId} ORDER BY created_at ASC`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? []));
    const allCases = await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable);
    const caseMap = Object.fromEntries(allCases.map((c) => [c.id, c.title]));

    const groups: Record<string, typeof msgs> = {};
    for (const m of msgs) {
      const key = m.caseId ?? "__direct__";
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    const conversations = Object.entries(groups).map(([key, messages]) => {
      const lastMsg = messages[messages.length - 1];
      const unread = messages.filter((m: any) => m.direction === "inbound" && m.status !== "read").length;
      const name = key === "__direct__" ? "مراسلات مباشرة" : (caseMap[key] ?? `قضية ${key.slice(0, 8)}`);
      return {
        id: key,
        caseId: key === "__direct__" ? null : key,
        name,
        channel: lastMsg.channel ?? "internal",
        lastMsg: lastMsg.content,
        time: lastMsg.createdAt.toISOString(),
        unread,
        starred: false,
        online: false,
        caseRef: key !== "__direct__" ? key.slice(0, 8).toUpperCase() : undefined,
        messages: messages.map((m: any) => ({
          id: m.id,
          from: m.direction === "inbound" ? "client" : "me",
          content: m.content,
          time: m.createdAt.toISOString(),
          status: m.status ?? undefined,
          channel: m.channel ?? "internal",
        })),
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
    // Office scope comes ONLY from req.tenantId — see comment above.
    const tenantId = (req as any).tenantId as string;
    const query = ListMessagesQueryParams.parse(req.query);
    let msgs = await db.execute(sql`SELECT * FROM messages WHERE office_id=${tenantId} ORDER BY created_at ASC`).then((r: any) => Array.isArray(r) ? r : (r?.rows ?? [])) as any[];
    if (query.caseId) msgs = msgs.filter((m) => m.caseId === query.caseId);
    if (query.channel) msgs = msgs.filter((m) => m.channel === query.channel);

    const caseIds = [...new Set(msgs.map((m) => m.caseId).filter(Boolean))] as string[];
    const cases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable)
      : [];
    const caseMap = Object.fromEntries(cases.map((c) => [c.id, c.title]));

    res.json(msgs.map((m) => ({
      id: m.id, caseId: m.caseId, caseName: m.caseId ? (caseMap[m.caseId] ?? null) : null,
      channel: m.channel, direction: m.direction, content: m.content, status: m.status,
      createdAt: m.createdAt.toISOString(),
    })));
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
    /*
     * CONFIRMED (out of scope for this fix): messagesTable (Drizzle schema
     * lib/db/src/schema/messages.ts) has no officeId/office_id column, and no
     * migration adds one — inserting one here would fail at runtime and
     * requires a schema migration, which is out of scope for this PR.
     * requireAuthWithTenant above still guarantees u.officeId (via
     * resolveTenantId) is a real, canonical tenant — never the Clerk user id.
     */
    const [created] = await db.insert(messagesTable).values({
      caseId: body.caseId ?? null,
      channel: body.channel,
      direction: "outbound",
      content: body.content,
      status: "sent",
    }).returning();
    res.status(201).json({ ...created, caseName: null, createdAt: created.createdAt.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
