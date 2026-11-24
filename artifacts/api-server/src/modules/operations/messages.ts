/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- pre-existing lint debt */
import { requireAuthWithTenant, checkIsSuperAdmin} from "../../middlewares/requireAuth";
import { Router } from "express";
import { db, casesTable } from "@workspace/db";
import { ListMessagesQueryParams, SendMessageBody } from "@workspace/api-zod";
import { getAuth, createClerkClient } from "@clerk/express";
import { sql, eq } from "drizzle-orm";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tenantIdOf(req: any): string | null {
  const tid = req?.tenantId;
  if (!tid || !UUID_RE.test(String(tid))) return null;
  return String(tid);
}

function sqlAll(r: any): any[] {
  if (Array.isArray(r)) return r;
  if (r && Array.isArray(r.rows)) return r.rows;
  return [];
}

function sqlOne(r: any): any {
  return sqlAll(r)[0] ?? null;
}

let messagesOfficeReady = false;
async function ensureMessagesOfficeId() {
  if (messagesOfficeReady) return;
  await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS office_id TEXT`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_office_id ON messages(office_id)`);
  messagesOfficeReady = true;
}

// ── Auth + comm-perm helper (mirrors client-portal.ts) ───────────────────────
let _clerkMsg: ReturnType<typeof createClerkClient> | null = null;
const getClerkMsg = () => {
  if (!_clerkMsg) _clerkMsg = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerkMsg;
};
/**
 * officeId is ALWAYS req.tenantId from requireAuthWithTenant.
 * Never fall back to Clerk user id as a tenant key.
 */
async function getMsgUser(req: any) {
  const auth = getAuth(req);
  if (!auth?.userId) return null;
  try {
    const user = await getClerkMsg().users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const isSA = await checkIsSuperAdmin(auth.userId);
    const officeId = tenantIdOf(req);
    if (!officeId) return null;
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
    await ensureMessagesOfficeId();
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const msgs = sqlAll(await db.execute(sql`
      SELECT * FROM messages WHERE office_id=${tenantId} ORDER BY created_at ASC
    `));
    const allCases = await db.select({ id: casesTable.id, title: casesTable.title })
      .from(casesTable)
      .where(eq(casesTable.officeId, tenantId));
    const caseMap = Object.fromEntries(allCases.map((c) => [c.id, c.title]));

    const groups: Record<string, typeof msgs> = {};
    for (const m of msgs) {
      const key = m.case_id ?? m.caseId ?? "__direct__";
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    const conversations = Object.entries(groups).map(([key, messages]) => {
      const lastMsg = messages[messages.length - 1];
      const unread = messages.filter((m: any) => (m.direction === "inbound") && (m.status !== "read")).length;
      const name = key === "__direct__" ? "مراسلات مباشرة" : (caseMap[key] ?? `قضية ${key.slice(0, 8)}`);
      const createdAt = lastMsg.created_at ?? lastMsg.createdAt;
      return {
        id: key,
        caseId: key === "__direct__" ? null : key,
        name,
        channel: lastMsg.channel ?? "internal",
        lastMsg: lastMsg.content,
        time: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
        unread,
        starred: false,
        online: false,
        caseRef: key !== "__direct__" ? key.slice(0, 8).toUpperCase() : undefined,
        messages: messages.map((m: any) => ({
          id: m.id,
          from: m.direction === "inbound" ? "client" : "me",
          content: m.content,
          time: new Date(m.created_at ?? m.createdAt).toISOString(),
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
    await ensureMessagesOfficeId();
    const tenantId = tenantIdOf(req);
    if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const query = ListMessagesQueryParams.parse(req.query);
    let msgs = sqlAll(await db.execute(sql`
      SELECT * FROM messages WHERE office_id=${tenantId} ORDER BY created_at ASC
    `));
    if (query.caseId) msgs = msgs.filter((m) => (m.case_id ?? m.caseId) === query.caseId);
    if (query.channel) msgs = msgs.filter((m) => m.channel === query.channel);

    const caseIds = [...new Set(msgs.map((m) => m.case_id ?? m.caseId).filter(Boolean))] as string[];
    const cases = caseIds.length > 0
      ? await db.select({ id: casesTable.id, title: casesTable.title }).from(casesTable).where(eq(casesTable.officeId, tenantId))
      : [];
    const caseMap = Object.fromEntries(cases.map((c) => [c.id, c.title]));

    res.json(msgs.map((m) => {
      const caseId = m.case_id ?? m.caseId;
      return {
        id: m.id, caseId, caseName: caseId ? (caseMap[caseId] ?? null) : null,
        channel: m.channel, direction: m.direction, content: m.content, status: m.status,
        createdAt: new Date(m.created_at ?? m.createdAt).toISOString(),
      };
    }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/messages", requireAuthWithTenant, async (req, res) => {
  await ensureMessagesOfficeId();
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
    const created = sqlOne(await db.execute(sql`
      INSERT INTO messages (office_id, case_id, channel, direction, content, status)
      VALUES (${u.officeId}, ${body.caseId ?? null}, ${body.channel}, 'outbound', ${body.content}, 'sent')
      RETURNING *
    `));
    if (!created) return res.status(500).json({ error: "فشل إرسال الرسالة" });
    res.status(201).json({
      id: created.id,
      caseId: created.case_id,
      caseName: null,
      channel: created.channel,
      direction: created.direction,
      content: created.content,
      status: created.status,
      createdAt: new Date(created.created_at).toISOString(),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
