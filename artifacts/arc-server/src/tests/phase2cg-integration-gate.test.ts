import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { runIntegrationHarness, harnessDeployTriggerAvailable } from "../lib/integrationHarness.js";
import {
  validateOidcEnv,
  validateGithubEnv,
  redactEnvSnapshot,
} from "../lib/integrationConfig.js";
import { allowDevHmac, issueDevCredential } from "../lib/identity.js";
import { coolifyAdapter } from "../adapters/coolify.js";
import {
  GITHUB_APP_PERMISSION_SPEC,
  GITHUB_APP_FORBIDDEN_PERMISSIONS,
  buildAppJwt,
  githubAppConfigPresent,
} from "../adapters/githubApp.js";
import { roleHasPermission } from "../lib/permissions.js";
import { generateKeyPairSync } from "node:crypto";

async function listen(): Promise<{ server: Server; base: string }> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  return { server, base: `http://127.0.0.1:${addr.port}` };
}

describe("ARC Phase 2C-G integration gate", () => {
  let server: Server;
  let base: string;

  before(async () => {
    ({ server, base } = await listen());
  });
  after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("harness runs fixture cases without claiming live success", async () => {
    const report = await runIntegrationHarness();
    assert.equal(report.phase, "2CG");
    assert.equal(report.deploymentExecutionEnabled, false);
    assert.equal(report.coolifyExecuteDeploy, false);
    assert.equal(harnessDeployTriggerAvailable(), false);
    assert.ok(report.summary.VERIFIED_FIXTURE > 0);
    assert.equal(report.summary.VERIFIED_LIVE_TEST, 0);
    const liveOidc = report.cases.find((c) => c.id === "oidc.live");
    assert.ok(liveOidc);
    assert.ok(
      liveOidc.result === "VERIFIED_FIXTURE" ||
        liveOidc.result === "BLOCKED_NO_CREDENTIALS" ||
        liveOidc.result === "BLOCKED_NO_AUTHORIZATION",
    );
    assert.notEqual(liveOidc.result, "VERIFIED_LIVE_TEST");
  });

  it("OIDC live mode without JWKS → BLOCKED_NO_CREDENTIALS and HMAC disabled", () => {
    const prevMode = process.env.ARC_OIDC_MODE;
    const prevHmac = process.env.ARC_ALLOW_DEV_HMAC;
    process.env.ARC_OIDC_MODE = "live";
    delete process.env.ARC_OIDC_JWKS_URL;
    process.env.ARC_ALLOW_DEV_HMAC = "true";
    try {
      const v = validateOidcEnv();
      assert.equal(v.ok, false);
      assert.equal(v.liveGate, "BLOCKED_NO_CREDENTIALS");
      assert.equal(allowDevHmac(), false);
      const issued = issueDevCredential("owner");
      assert.ok("error" in issued);
    } finally {
      if (prevMode === undefined) delete process.env.ARC_OIDC_MODE;
      else process.env.ARC_OIDC_MODE = prevMode;
      if (prevHmac === undefined) delete process.env.ARC_ALLOW_DEV_HMAC;
      else process.env.ARC_ALLOW_DEV_HMAC = prevHmac;
    }
  });

  it("OIDC rejects production customer IdP host in test config", () => {
    const v = validateOidcEnv({
      ARC_OIDC_MODE: "live",
      ARC_OIDC_ISSUER: "https://clerk.adalah.ai",
      ARC_OIDC_AUDIENCE: "adalah-arc",
      ARC_OIDC_JWKS_URL: "https://clerk.adalah.ai/.well-known/jwks.json",
      ARC_ALLOW_DEV_HMAC: "false",
    } as NodeJS.ProcessEnv);
    assert.equal(v.ok, false);
    assert.ok(v.issues.some((i) => /blocked for test-only/i.test(i.message)));
  });

  it("GitHub live without credentials → BLOCKED_NO_CREDENTIALS", () => {
    const prevMode = process.env.ARC_GITHUB_MODE;
    const prevTok = process.env.ARC_GITHUB_TOKEN;
    process.env.ARC_GITHUB_MODE = "live";
    delete process.env.ARC_GITHUB_TOKEN;
    delete process.env.ARC_GITHUB_APP_ID;
    try {
      const v = validateGithubEnv();
      assert.equal(v.ok, false);
      assert.equal(v.liveGate, "BLOCKED_NO_CREDENTIALS");
    } finally {
      if (prevMode === undefined) delete process.env.ARC_GITHUB_MODE;
      else process.env.ARC_GITHUB_MODE = prevMode;
      if (prevTok === undefined) delete process.env.ARC_GITHUB_TOKEN;
      else process.env.ARC_GITHUB_TOKEN = prevTok;
    }
  });

  it("GitHub mutation flag rejected", () => {
    const prev = process.env.ARC_GITHUB_ALLOW_MUTATION;
    const prevMode = process.env.ARC_GITHUB_MODE;
    process.env.ARC_GITHUB_MODE = "live";
    process.env.ARC_GITHUB_TOKEN = "placeholder-not-real";
    process.env.ARC_GITHUB_REPO_ALLOWLIST = "eadala/adala-ai-arc-test";
    process.env.ARC_GITHUB_ALLOW_MUTATION = "true";
    try {
      const v = validateGithubEnv();
      assert.equal(v.ok, false);
      assert.ok(v.issues.some((i) => i.variable === "ARC_GITHUB_ALLOW_MUTATION"));
    } finally {
      if (prev === undefined) delete process.env.ARC_GITHUB_ALLOW_MUTATION;
      else process.env.ARC_GITHUB_ALLOW_MUTATION = prev;
      if (prevMode === undefined) delete process.env.ARC_GITHUB_MODE;
      else process.env.ARC_GITHUB_MODE = prevMode;
      delete process.env.ARC_GITHUB_TOKEN;
    }
  });

  it("env snapshot redacts secrets", () => {
    process.env.ARC_GITHUB_TOKEN = "ghp_SHOULD_NOT_APPEAR";
    const snap = redactEnvSnapshot(["ARC_GITHUB_TOKEN", "ARC_OIDC_MODE"]);
    assert.equal(snap.ARC_GITHUB_TOKEN, "<redacted>");
    assert.notEqual(snap.ARC_GITHUB_TOKEN, "ghp_SHOULD_NOT_APPEAR");
    delete process.env.ARC_GITHUB_TOKEN;
  });

  it("GitHub App permission spec is read-only justified", () => {
    assert.ok(GITHUB_APP_PERMISSION_SPEC.every((p) => p.access === "read"));
    assert.ok(GITHUB_APP_FORBIDDEN_PERMISSIONS.includes("Contents:write"));
    assert.equal(githubAppConfigPresent(), false);
  });

  it("App JWT builder signs with operator-supplied PEM (synthetic local key only)", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = buildAppJwt({ appId: "123456", privateKeyPem: pem });
    assert.equal(jwt.ok, true);
    if (jwt.ok) assert.equal(jwt.jwt.split(".").length, 3);
  });

  it("API harness endpoint returns gate classifications", async () => {
    const res = await fetch(`${base}/api/arc/integration/harness`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      phase: string;
      summary: Record<string, number>;
      deploymentExecutionEnabled: boolean;
    };
    assert.equal(body.phase, "2CG");
    assert.equal(body.deploymentExecutionEnabled, false);
    assert.ok((body.summary.VERIFIED_FIXTURE ?? 0) > 0);
  });

  it("config endpoint never returns secret values", async () => {
    process.env.ARC_GITHUB_TOKEN = "ghp_leak_test";
    try {
      const res = await fetch(`${base}/api/arc/integration/config`);
      const text = await res.text();
      assert.doesNotMatch(text, /ghp_leak_test/);
      assert.match(text, /redacted|placeholder|Permissions/i);
    } finally {
      delete process.env.ARC_GITHUB_TOKEN;
    }
  });

  it("deployment safety invariants hold", async () => {
    assert.equal(coolifyAdapter.capabilities().executeDeploy, false);
    assert.equal(roleHasPermission("ai_agent", "deployment:request"), false);
    assert.equal(roleHasPermission("platform_owner", "deployment:execute"), false);
    const issued = issueDevCredential("owner");
    assert.ok("token" in issued);
    const res = await fetch(`${base}/api/arc/deployments/execute`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${issued.token}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(res.status, 403);
  });

  it("healthz phase 2CG", async () => {
    const res = await fetch(`${base}/api/arc/healthz`);
    const body = (await res.json()) as {
      phase: string;
      harnessDeployTriggerAvailable: boolean;
      coolifyProduction: string;
    };
    assert.equal(body.phase, "2CG");
    assert.equal(body.harnessDeployTriggerAvailable, false);
    assert.equal(body.coolifyProduction, "NOT_CONNECTED");
  });
});
