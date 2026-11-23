/**
 * Web Push utility — VAPID key management + send helpers
 */
import webpush from "web-push";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/* ── Ensure tables ─────────────────────────────────────── */
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL,
      office_id   TEXT NOT NULL DEFAULT 'default',
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth_key    TEXT NOT NULL,
      user_agent  TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS server_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).catch(() => {});
}
ensureTables();

/* ── VAPID key management ──────────────────────────────── */
let _vapidPublic  = "";
let _vapidPrivate = "";
let _initialized  = false;

export async function initVapid(): Promise<void> {
  if (_initialized) return;

  /* Try loading from DB */
  const rows = await db.execute(sql`
    SELECT key, value FROM server_config WHERE key IN ('vapid_public','vapid_private')
  `).catch(() => ({ rows: [] }));

  const cfg: Record<string, string> = {};
  for (const r of rows.rows as any[]) cfg[r.key] = r.value;

  if (cfg["vapid_public"] && cfg["vapid_private"]) {
    _vapidPublic  = cfg["vapid_public"];
    _vapidPrivate = cfg["vapid_private"];
  } else {
    /* Generate fresh VAPID keys */
    const keys = webpush.generateVAPIDKeys();
    _vapidPublic  = keys.publicKey;
    _vapidPrivate = keys.privateKey;

    await db.execute(sql`
      INSERT INTO server_config (key, value) VALUES ('vapid_public',  ${_vapidPublic})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `).catch(() => {});
    await db.execute(sql`
      INSERT INTO server_config (key, value) VALUES ('vapid_private', ${_vapidPrivate})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `).catch(() => {});

    console.log("[WebPush] ✅ VAPID keys generated and stored");
  }

  webpush.setVapidDetails(
    "mailto:admin@adalah-ai.sa",
    _vapidPublic,
    _vapidPrivate,
  );
  _initialized = true;
  console.log("[WebPush] ✅ VAPID initialized");
}

export function getVapidPublicKey(): string { return _vapidPublic; }

/* ── Send to one subscription ──────────────────────────── */
export async function sendPush(
  endpoint: string,
  p256dh: string,
  authKey: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth: authKey } },
      JSON.stringify(payload),
      { TTL: 86400 }
    );
    return true;
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      /* Subscription expired — clean up */
      await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`).catch(() => {});
    }
    return false;
  }
}

/* ── Send to all subscriptions of an office ───────────── */
export async function sendPushToOffice(
  officeId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<void> {
  if (!_initialized) return;
  try {
    const rows = await db.execute(sql`
      SELECT endpoint, p256dh, auth_key FROM push_subscriptions WHERE office_id = ${officeId}
    `);
    const subs = rows.rows as any[];
    await Promise.allSettled(
      subs.map(s => sendPush(s.endpoint, s.p256dh, s.auth_key, payload))
    );
  } catch {}
}

/* ── Send to all subscriptions globally ────────────────── */
export async function sendPushToAll(
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<void> {
  if (!_initialized) return;
  try {
    const rows = await db.execute(sql`SELECT endpoint, p256dh, auth_key FROM push_subscriptions`);
    const subs = rows.rows as any[];
    await Promise.allSettled(
      subs.map(s => sendPush(s.endpoint, s.p256dh, s.auth_key, payload))
    );
  } catch {}
}
