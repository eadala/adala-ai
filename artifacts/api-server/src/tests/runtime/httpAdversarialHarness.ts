/**
 * ADALA-SEC-TENANT-P0-006 — real Express HTTP adversarial harness.
 * Uses test-auth gate + real middleware/handlers against isolated DB.
 *
 * Env:
 *   DATABASE_URL → adala_tenant_runtime
 *   ADALA_HTTP_SECURITY_TEST=1
 *   ADALA_TEST_AUTH_SECRET=runtime-assurance-secret-key
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import crypto from "node:crypto";
import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

process.env.ADALA_HTTP_SECURITY_TEST = "1";
process.env.ADALA_TEST_AUTH_SECRET = process.env.ADALA_TEST_AUTH_SECRET || "runtime-assurance-secret-key";
process.env.WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || "wa-test-secret";
process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "test" : (process.env.NODE_ENV || "test");

const OFFICE_A = "c9efc92a-41ab-46b4-9aa1-baf867882149";
const OFFICE_B = "cfee909e-5821-4085-8c6a-90a3852ae437";
const SECRET = process.env.ADALA_TEST_AUTH_SECRET || "runtime-assurance-secret-key";
const WA_SECRET = process.env.WHATSAPP_APP_SECRET || "wa-test-secret";

const HERE = dirname(fileURLToPath(import.meta.url));

async function seed(): Promise<void> {
  const sql = readFileSync(join(HERE, "seedRuntimeSchema.sql"), "utf8");
  await pool.query(sql);
}

function authHeaders(userId: string, tenant?: string): Record<string, string> {
  const h: Record<string, string> = {
    "x-adala-test-auth": SECRET,
    "x-adala-test-user": userId,
    "content-type": "application/json",
  };
  if (tenant) h["x-tenant-id"] = tenant;
  return h;
}

function signWhatsApp(body: unknown): { headers: Record<string, string>; raw: string } {
  const raw = JSON.stringify(body);
  const sig = "sha256=" + crypto.createHmac("sha256", WA_SECRET).update(raw).digest("hex");
  return {
    raw,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": sig,
    },
  };
}

async function main(): Promise<void> {
  await seed();

  const { default: officeRouter } = await import("../../modules/marketplace/office.js");
  const { default: paymentsRouter } = await import("../../modules/financial/payments.js");
  const { default: aiCreditsRouter } = await import("../../modules/ai/aiCredits.js");
  const { default: aiAgentRouter } = await import("../../modules/ai/ai-agent.js");
  const { default: webhookRouter } = await import("../../modules/integrations/webhook.js");

  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }));
  app.use("/api", officeRouter);
  app.use("/api", paymentsRouter);
  app.use("/api", aiCreditsRouter);
  app.use("/api", aiAgentRouter);
  app.use("/api", webhookRouter);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const base = `http://127.0.0.1:${addr.port}`;

  const results: { id: string; ok: boolean; detail: string }[] = [];
  async function hit(
    id: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    expectStatus: number | number[],
    body?: unknown,
  ): Promise<Response> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const allowed = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
    const ok = allowed.includes(res.status);
    const text = await res.clone().text();
    results.push({ id, ok, detail: `HTTP ${res.status} ${text.slice(0, 120)}` });
    assert.ok(ok, `${id}: expected ${allowed.join("|")} got ${res.status} ${text.slice(0, 200)}`);
    return res;
  }

  /* 1 Cross-office IDOR denial */
  await hit(
    "OFFICE_IDOR_CROSS",
    "GET",
    `/api/office/my/${OFFICE_B}/services`,
    authHeaders("user-a-owner", OFFICE_A),
    403,
  );

  /* 13 Same-tenant authorized */
  const same = await hit(
    "OFFICE_SAME_TENANT",
    "GET",
    `/api/office/my/${OFFICE_A}/services`,
    authHeaders("user-a-owner", OFFICE_A),
    200,
  );
  const sameJson = await same.json() as unknown[];
  assert.ok(Array.isArray(sameJson) && sameJson.length >= 1);

  /* 14 Multi-office membership — select B */
  await hit(
    "MULTI_OFFICE_SELECT_B",
    "GET",
    `/api/office/my/${OFFICE_B}/services`,
    authHeaders("user-multi", OFFICE_B),
    200,
  );

  /* 2 Payments isolation */
  const pays = await hit(
    "PAYMENTS_LIST_A",
    "GET",
    "/api/payments/transactions",
    authHeaders("user-a-owner", OFFICE_A),
    200,
  );
  const payRows = await pays.json() as { office_id?: string; officeId?: string; id?: string }[];
  assert.ok(Array.isArray(payRows));
  assert.ok(!JSON.stringify(payRows).includes("22222222-2222-4222-8222-2222222222bb"), "must not leak B payment id");
  assert.ok(
    payRows.every((r) => {
      const oid = r.office_id ?? r.officeId;
      return oid === undefined || oid === OFFICE_A;
    }),
    "payment rows must be tenant A only",
  );

  /* 3 Forged tenant header */
  await hit(
    "FORGED_HEADER",
    "GET",
    `/api/office/my/${OFFICE_B}/services`,
    authHeaders("user-a-owner", OFFICE_B),
    403,
  );

  /* 4 Revoked membership */
  await hit(
    "REVOKED_MEMBER",
    "GET",
    `/api/office/my/${OFFICE_A}/services`,
    authHeaders("user-revoked", OFFICE_A),
    [401, 403],
  );

  /* 5 Cross-tenant AI credits — body officeId ignored; charges A only */
  const before = await pool.query(
    `SELECT balance FROM office_ai_credits WHERE office_id=$1`,
    [OFFICE_B],
  );
  const balB = Number(before.rows[0].balance);
  await hit(
    "AI_CREDITS_CROSS_BODY",
    "POST",
    "/api/ai-credits/deduct",
    authHeaders("user-a-owner", OFFICE_A),
    [200, 402],
    { officeId: OFFICE_B, cost: 1, model: "test" },
  );
  const after = await pool.query(
    `SELECT balance FROM office_ai_credits WHERE office_id=$1`,
    [OFFICE_B],
  );
  assert.equal(Number(after.rows[0].balance), balB, "Tenant B balance must not change");

  /* 6 Cross-tenant AI agent logs */
  const logs = await hit(
    "AI_AGENT_LOGS_A",
    "GET",
    "/api/ai-agent/logs",
    authHeaders("user-a-owner", OFFICE_A),
    200,
  );
  const logBody = await logs.text();
  assert.ok(!logBody.includes("log-b"), "must not leak B agent logs");

  /* 7 WhatsApp unsigned denied */
  await hit("WHATSAPP_UNSIGNED", "POST", "/api/webhook/whatsapp", { "content-type": "application/json" }, 403, {
    object: "whatsapp_business_account",
    entry: [],
  });

  /* 7b WhatsApp signed — phone B must not write into tenant A / status cross-update denied */
  const crossStatusBody = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: "phone-b" },
          statuses: [{ id: "ext-a", status: "read" }],
        },
      }],
    }],
  };
  const signed = signWhatsApp(crossStatusBody);
  const waRes = await fetch(`${base}/api/webhook/whatsapp`, {
    method: "POST",
    headers: signed.headers,
    body: signed.raw,
  });
  const waOk = waRes.status === 200;
  results.push({ id: "WHATSAPP_CROSS_STATUS", ok: waOk, detail: `HTTP ${waRes.status}` });
  assert.ok(waOk, "signed webhook should ack");
  const msgA = await pool.query(`SELECT status FROM messages WHERE id='msg-a'`);
  assert.equal(msgA.rows[0].status, "received", "provider id from phone-b must not mutate tenant A message");

  /* 8 Role-specific — lawyer can read own office services */
  await hit(
    "ROLE_LAWYER_SAME",
    "GET",
    `/api/office/my/${OFFICE_A}/services`,
    authHeaders("user-a-lawyer", OFFICE_A),
    200,
  );
  await hit(
    "ROLE_ACCOUNTANT_SAME",
    "GET",
    `/api/office/my/${OFFICE_A}/services`,
    authHeaders("user-a-accountant", OFFICE_A),
    200,
  );

  /* 9 Cross-tenant list pagination — payments page must not include B */
  const page = await hit(
    "PAYMENTS_PAGINATION_A",
    "GET",
    "/api/payments/transactions?limit=100&offset=0",
    authHeaders("user-a-owner", OFFICE_A),
    200,
  );
  assert.ok(!JSON.stringify(await page.json()).includes(OFFICE_B));

  /* 10 Cross-tenant search/aggregation — AI agent workflows scoped */
  const wfs = await hit(
    "AI_WORKFLOWS_SCOPED",
    "GET",
    "/api/ai-agent/workflows",
    authHeaders("user-a-owner", OFFICE_A),
    [200, 404],
  );
  if (wfs.status === 200) {
    const wfText = await wfs.text();
    assert.ok(!wfText.includes("wf-b"), "must not leak B workflows");
  }

  /* 11 Missing auth / missing tenant context */
  await hit("MISSING_AUTH", "GET", `/api/office/my/${OFFICE_A}/services`, {}, 401);
  await hit(
    "UNAUTHORIZED_USER",
    "GET",
    `/api/office/my/${OFFICE_A}/services`,
    authHeaders("user-none", OFFICE_A),
    [401, 403],
  );

  /* 12 Conflicting identifiers — path B vs tenant A */
  await hit(
    "CONFLICT_PATH_TENANT",
    "GET",
    `/api/office/my/${OFFICE_B}/services`,
    authHeaders("user-a-owner", OFFICE_A),
    403,
  );

  /* 15 Privilege escalation — non-admin cannot hit admin AI credits */
  await hit(
    "PRIV_ESC_AI_ADMIN",
    "GET",
    "/api/admin/ai-credits",
    authHeaders("user-a-owner", OFFICE_A),
    [401, 403],
  );

  const failed = results.filter((r) => !r.ok);
  const report = {
    suite: "http-adversarial",
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    skipped: 0,
    results,
  };
  console.log(JSON.stringify(report, null, 2));
  server.close();
  await pool.end();
  if (failed.length) process.exit(1);
  console.log("PASS http adversarial harness");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
