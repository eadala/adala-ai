import { requireAuth, checkIsSuperAdmin} from "../../middlewares/requireAuth";
import { resolveTenantId } from "../../middlewares/tenantMiddleware";
import { linkClientCase } from "../../lib/clientCaseLinkWrite";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { getAuth, createClerkClient } from "@clerk/express";

const router = Router();
const scryptAsync = promisify(scrypt);

// ─── helpers ─────────────────────────────────────────────────────────────────
function sqlOne(res: any) { return (res?.rows ?? res)?.[0] ?? null; }
function sqlAll(res: any) { return res?.rows ?? res ?? []; }

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [hash, salt] = stored.split(".");
  if (!hash || !salt) return false;
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(hash, "hex");
  return buf.length === storedBuf.length && timingSafeEqual(buf, storedBuf);
}

function makeToken(): string { return randomBytes(32).toString("hex"); }

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_accounts (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email        TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name         TEXT,
      phone        TEXT,
      email_verified BOOLEAN DEFAULT false,
      otp          TEXT,
      otp_expires  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_sessions (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      client_id  TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_case_links (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      client_id       TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
      case_id         TEXT NOT NULL,
      portal_token_id TEXT,
      portal_token    TEXT,
      office_id       TEXT,
      linked_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_id, case_id)
    )
  `);
}
ensureTables().catch(console.error);

// ─── auth middleware for client sessions ─────────────────────────────────────
async function getClientSession(req: Request): Promise<{ clientId: string; email: string; name: string } | null> {
  const authHeader = req.headers.authorization ?? "";
  const cookieToken = (req as any).cookies?.client_session ?? "";
  const token = authHeader.replace("Bearer ", "").trim() || cookieToken || (String(req.query.ct));
  if (!token || token === "undefined") return null;
  const row = sqlOne(await db.execute(sql`
    SELECT cs.client_id, ca.email, ca.name
    FROM client_sessions cs
    JOIN client_accounts ca ON ca.id = cs.client_id
    WHERE cs.token = ${token} AND cs.expires_at > NOW()
    LIMIT 1
  `));
  if (!row) return null;
  return { clientId: row.client_id, email: row.email, name: row.name };
}

// ═══════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════
router.post("/client-auth/register", async (req: Request, res: Response) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password) { res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }); return; }
  try {
    const existing = sqlOne(await db.execute(sql`SELECT id FROM client_accounts WHERE email = ${email.toLowerCase()} LIMIT 1`));
    if (existing) { res.status(409).json({ error: "هذا البريد مسجّل مسبقاً — يمكنك تسجيل الدخول" }); return; }

    const hash = await hashPassword(password);
    const id = randomBytes(16).toString("hex");
    await db.execute(sql`
      INSERT INTO client_accounts (id, email, password_hash, name, phone)
      VALUES (${id}, ${email.toLowerCase()}, ${hash}, ${name ?? null}, ${phone ?? null})
    `);

    const sessionToken = makeToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO client_sessions (client_id, token, expires_at)
      VALUES (${id}, ${sessionToken}, ${expiresAt.toISOString()})
    `);

    res.cookie("client_session", sessionToken, {
      httpOnly: true, secure: true, sameSite: "strict",
      expires: expiresAt, path: "/",
    });
    res.status(201).json({ token: sessionToken, client: { id, email: email.toLowerCase(), name: name ?? null } });
  } catch (e: any) {
        res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════
router.post("/client-auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "البريد وكلمة المرور مطلوبان" }); return; }
  try {
    const row = sqlOne(await db.execute(sql`SELECT id, email, password_hash, name FROM client_accounts WHERE email = ${email.toLowerCase()} LIMIT 1`));
    if (!row) { res.status(401).json({ error: "البريد أو كلمة المرور غير صحيحة" }); return; }
    if (!row.password_hash) { res.status(401).json({ error: "هذا الحساب لا يستخدم كلمة مرور — استخدم رمز الدخول السريع" }); return; }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) { res.status(401).json({ error: "البريد أو كلمة المرور غير صحيحة" }); return; }

    const sessionToken = makeToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.execute(sql`INSERT INTO client_sessions (client_id, token, expires_at) VALUES (${row.id}, ${sessionToken}, ${expiresAt.toISOString()})`);

    res.json({ token: sessionToken, client: { id: row.id, email: row.email, name: row.name } });
  } catch (e: any) {
        res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// OTP — request
// ═══════════════════════════════════════════════════════════════════
router.post("/client-auth/request-otp", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "البريد الإلكتروني مطلوب" }); return; }
  try {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    const existing = sqlOne(await db.execute(sql`SELECT id FROM client_accounts WHERE email = ${email.toLowerCase()} LIMIT 1`));
    if (!existing) {
      const id = randomBytes(16).toString("hex");
      await db.execute(sql`INSERT INTO client_accounts (id, email, otp, otp_expires) VALUES (${id}, ${email.toLowerCase()}, ${otp}, ${expires.toISOString()})`);
    } else {
      await db.execute(sql`UPDATE client_accounts SET otp = ${otp}, otp_expires = ${expires.toISOString()} WHERE email = ${email.toLowerCase()}`);
    }

    // Send OTP email via existing email infrastructure (fire-and-forget)
    try {
      const { getEmailTransporter } = await import("./client-portal.js");
      const transporter = getEmailTransporter();
      if (transporter) {
        await transporter.sendMail({
          from: process.env.SMTP_USER ?? "noreply@adalah-ai.sa",
          to: email,
          subject: "رمز دخول بوابة عدالة AI — " + otp,
          html: `<div dir="rtl" style="font-family:Cairo,sans-serif;padding:24px;background:#0d1b2a;color:#fff;border-radius:12px">
            <h2 style="color:#C9A84C">رمز دخولك: <strong style="font-size:28px;letter-spacing:4px">${otp}</strong></h2>
            <p style="color:#aaa">صالح لمدة 10 دقائق فقط. لا تشاركه مع أحد.</p>
          </div>`,
        });
      }
    } catch (_) {}

    res.json({ ok: true, hint: `تم إرسال رمز مكوّن من 6 أرقام إلى ${email}` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// OTP — verify
// ═══════════════════════════════════════════════════════════════════
router.post("/client-auth/verify-otp", async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) { res.status(400).json({ error: "البريد والرمز مطلوبان" }); return; }
  try {
    const row = sqlOne(await db.execute(sql`
      SELECT id, email, name FROM client_accounts
      WHERE email = ${email.toLowerCase()} AND otp = ${String(otp)} AND otp_expires > NOW()
      LIMIT 1
    `));
    if (!row) { res.status(401).json({ error: "الرمز غير صحيح أو انتهت صلاحيته" }); return; }

    await db.execute(sql`UPDATE client_accounts SET otp = NULL, otp_expires = NULL, email_verified = true WHERE id = ${row.id}`);

    const sessionToken = makeToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.execute(sql`INSERT INTO client_sessions (client_id, token, expires_at) VALUES (${row.id}, ${sessionToken}, ${expiresAt.toISOString()})`);

    res.cookie("client_session", sessionToken, {
      httpOnly: true, secure: true, sameSite: "strict",
      expires: expiresAt, path: "/",
    });
    res.json({ token: sessionToken, client: { id: row.id, email: row.email, name: row.name } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════
router.post("/client-auth/logout", async (req: Request, res: Response) => {
  const cookieToken = (req as any).cookies?.client_session ?? "";
  const headerToken = req.headers.authorization?.replace("Bearer ", "").trim() ?? "";
  const token = headerToken || cookieToken;
  if (token) await db.execute(sql`DELETE FROM client_sessions WHERE token = ${token}`).catch(() => {});
  res.clearCookie("client_session", { path: "/" });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════
// ME — get current client profile + linked cases
// ═══════════════════════════════════════════════════════════════════
router.get("/client-auth/me", async (req: Request, res: Response) => {
  const session = await getClientSession(req);
  if (!session) { res.status(401).json({ error: "غير مصادق" }); return; }
  try {
    const profile = sqlOne(await db.execute(sql`SELECT id, email, name, phone, email_verified, created_at FROM client_accounts WHERE id = ${session.clientId}`));
    const links = sqlAll(await db.execute(sql`
      SELECT ccl.case_id, ccl.portal_token, ccl.office_id, ccl.linked_at,
             c.title as case_title, c.status as case_status, c.case_type,
             c.created_at as case_created_at
      FROM client_case_links ccl
      LEFT JOIN cases c ON c.id = ccl.case_id
      WHERE ccl.client_id = ${session.clientId}
      ORDER BY ccl.linked_at DESC
    `));
    res.json({ ...profile, linkedCases: links });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// UPDATE PROFILE
// ═══════════════════════════════════════════════════════════════════
router.patch("/client-auth/me", async (req: Request, res: Response) => {
  const session = await getClientSession(req);
  if (!session) { res.status(401).json({ error: "غير مصادق" }); return; }
  const { name, phone, password } = req.body;
  try {
    if (password) {
      if (password.length < 6) { res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }); return; }
      const hash = await hashPassword(password);
      await db.execute(sql`UPDATE client_accounts SET password_hash=${hash}, name=COALESCE(${name ?? null}, name), phone=COALESCE(${phone ?? null}, phone), updated_at=NOW() WHERE id=${session.clientId}`);
    } else {
      await db.execute(sql`UPDATE client_accounts SET name=COALESCE(${name ?? null}, name), phone=COALESCE(${phone ?? null}, phone), updated_at=NOW() WHERE id=${session.clientId}`);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// LINK PORTAL TOKEN — called after client accesses /portal/:token while logged in
// ═══════════════════════════════════════════════════════════════════
router.post("/client-auth/link-token", async (req: Request, res: Response) => {
  const session = await getClientSession(req);
  if (!session) { res.status(401).json({ error: "غير مصادق" }); return; }
  const { portalToken } = req.body;
  if (!portalToken) { res.status(400).json({ error: "رمز البوابة مطلوب" }); return; }
  try {
    const pt = sqlOne(await db.execute(sql`SELECT id, case_id FROM client_portal_tokens WHERE token = ${portalToken} LIMIT 1`));
    if (!pt) { res.status(404).json({ error: "رابط البوابة غير موجود أو منتهي" }); return; }

    const caseRow = sqlOne(await db.execute(sql`SELECT created_by FROM cases WHERE id = ${pt.case_id} LIMIT 1`));
    const officeId = caseRow?.created_by ?? null;

    await db.execute(sql`
      INSERT INTO client_case_links (client_id, case_id, portal_token_id, portal_token, office_id)
      VALUES (${session.clientId}, ${pt.case_id}, ${pt.id}, ${portalToken}, ${officeId})
      ON CONFLICT (client_id, case_id) DO UPDATE SET portal_token = ${portalToken}, portal_token_id = ${pt.id}
    `);
    res.json({ ok: true, caseId: pt.case_id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTES — create/list/reset client accounts
// ═══════════════════════════════════════════════════════════════

let _clerkCA: ReturnType<typeof createClerkClient> | null = null;
const getClerkCA = () => {
  if (!_clerkCA) _clerkCA = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerkCA;
};

/**
 * officeId is ALWAYS derived via the canonical resolveTenantId()
 * (membership-validated) — it must NEVER fall back to the Clerk user id.
 * Returns null (fail closed) when no tenant can be resolved; callers (e.g.
 * POST /client-auth/admin-create) already deny on a null result before any
 * write, so client_case_links.office_id can never receive a Clerk user id.
 */
async function getAdminUser(req: Request) {
  const auth = getAuth(req);
  if (!auth?.userId) return null;
  try {
    const user = await getClerkCA().users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const isSA = await checkIsSuperAdmin(auth.userId);
    const headerTenant = (req.headers?.["x-tenant-id"] as string | undefined);
    const officeId = await resolveTenantId(auth.userId, headerTenant);
    if (!officeId) return null; // fail closed — never substitute auth.userId
    const mRows = sqlAll(await db.execute(sql`SELECT role FROM office_members WHERE user_id=${auth.userId} AND office_id=${officeId} AND status='active' LIMIT 1`));
    const officeRole: string = mRows[0]?.role ?? (user.publicMetadata?.role as string) ?? "lawyer";
    const isAdmin = isSA || officeRole === "firm_owner" || officeRole === "office_manager";
    return { userId: auth.userId, officeId, email, isSA, officeRole, isAdmin };
  } catch { return null; }
}

/* POST /api/client-auth/admin-create
   Admin creates a client account and optionally links it to a case/portal token */
router.post("/client-auth/admin-create", requireAuth, async (req: Request, res: Response) => {
  const admin = await getAdminUser(req);
  if (!admin) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!admin.isAdmin) { res.status(403).json({ error: "يجب أن تكون مديراً لإنشاء حسابات العملاء" }); return; }

  const { email, password, name, phone, caseId, portalToken } = req.body;
  if (!email || !password) { res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }); return; }

  try {
    const existing = sqlOne(await db.execute(sql`SELECT id FROM client_accounts WHERE email=${email.toLowerCase()} LIMIT 1`));
    if (existing) { res.status(409).json({ error: "هذا البريد مسجّل مسبقاً — يمكن للعميل تسجيل الدخول مباشرة" }); return; }

    const hash = await hashPassword(password);
    const id = randomBytes(16).toString("hex");
    await db.execute(sql`
      INSERT INTO client_accounts (id, email, password_hash, name, phone, email_verified)
      VALUES (${id}, ${email.toLowerCase()}, ${hash}, ${name ?? null}, ${phone ?? null}, true)
    `);

    // Link to case if provided
    if (caseId) {
      const ptToken = portalToken ?? null;
      let ptId: string | null = null;
      if (ptToken) {
        const pt = sqlOne(await db.execute(sql`SELECT id FROM client_portal_tokens WHERE token=${ptToken} LIMIT 1`));
        ptId = pt?.id ?? null;
      }
      // Re-resolve (fail-closed, defense in depth) the canonical office
      // immediately before writing — never trust a previously-computed
      // officeId for the write itself. linkClientCase performs NO insert
      // when resolveTenantId returns null, so office_id can never receive
      // a Clerk user id.
      const headerTenant = req.headers?.["x-tenant-id"] as string | undefined;
      const linked = await linkClientCase(
        { userId: admin.userId, headerTenant, clientId: id, caseId, portalTokenId: ptId, portalToken: ptToken },
        { resolveTenantId, db },
      );
      if (!linked) { res.status(401).json({ error: "غير مصادق" }); return; }
    }

    res.status(201).json({
      ok: true,
      client: { id, email: email.toLowerCase(), name: name ?? null, phone: phone ?? null },
    });
  } catch (e: any) {
        res.status(500).json({ error: e.message });
  }
});

/* PATCH /api/client-auth/admin-reset-password/:clientId  — admin resets a client's password */
router.patch("/client-auth/admin-reset-password/:clientId", requireAuth, async (req: Request, res: Response) => {
  const admin = await getAdminUser(req);
  if (!admin) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!admin.isAdmin) { res.status(403).json({ error: "يجب أن تكون مديراً" }); return; }
  const { password } = req.body;
  if (!password || password.length < 6) { res.status(400).json({ error: "كلمة مرور جديدة (6 أحرف+) مطلوبة" }); return; }
  try {
    const hash = await hashPassword(password);
    await db.execute(sql`UPDATE client_accounts SET password_hash=${hash}, updated_at=NOW() WHERE id=${String(req.params.clientId)}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* GET /api/client-auth/admin-clients — list all client accounts linked to this office */
router.get("/client-auth/admin-clients", requireAuth, async (req: Request, res: Response) => {
  const admin = await getAdminUser(req);
  if (!admin) { res.status(401).json({ error: "غير مصادق" }); return; }
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT ca.id, ca.email, ca.name, ca.phone, ca.email_verified, ca.created_at,
             COUNT(ccl.case_id) as case_count,
             MAX(ccl.linked_at) as last_linked
      FROM client_accounts ca
      LEFT JOIN client_case_links ccl ON ccl.client_id = ca.id AND ccl.office_id = ${admin.officeId}
      GROUP BY ca.id
      ORDER BY ca.created_at DESC
      LIMIT 100
    `));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
