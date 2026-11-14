import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateArcBaseUrl,
  validateArcBaseUrlSync,
  proxyEnvPresent,
} from "../lib/validationBaseUrl.js";
import { roleHasPermission } from "../lib/permissions.js";
import { coolifyAdapter } from "../adapters/coolify.js";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function env(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const e: NodeJS.ProcessEnv = { ...process.env };
  for (const k of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "ARC_ALLOW_HTTP_PROXY",
    "ARC_BASE_URL_POLICY",
    "ARC_BASE_URL_ALLOWLIST",
    "ARC_BASE_URL_ALLOW_ANY_LOOPBACK_PORT",
  ]) {
    delete e[k];
  }
  Object.assign(e, extra);
  return e;
}

describe("F-PRELIVE-001 ARC_BASE_URL network hardening", () => {
  it("1. rejects arbitrary public URL", async () => {
    const r = await validateArcBaseUrl("http://evil.example:8787", {
      env: env(),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unauthorized_hostname");
  });

  it("2. rejects unauthorized private IP", async () => {
    const r = await validateArcBaseUrl("http://192.168.1.10:8787", {
      env: env(),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unauthorized_hostname");
  });

  it("3. accepts loopback alias localhost", async () => {
    const r = await validateArcBaseUrl("http://localhost:8787", {
      env: env(),
      dnsLookup: async () => ["127.0.0.1"],
    });
    assert.equal(r.ok, true);
  });

  it("4. accepts IPv6 loopback [::1]", async () => {
    const r = await validateArcBaseUrl("http://[::1]:8787", {
      env: env(),
      resolveDns: true,
    });
    assert.equal(r.ok, true);
  });

  it("5. rejects encoded hostname bypass", async () => {
    const r = await validateArcBaseUrl("http://evil%2eexample:8787", {
      env: env(),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
  });

  it("6. rejects URL userinfo injection", async () => {
    const r = await validateArcBaseUrl("http://user:pass@127.0.0.1:8787", {
      env: env(),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "embedded_credentials");
  });

  it("7. rejects unexpected port", async () => {
    const r = await validateArcBaseUrl("http://127.0.0.1:22", {
      env: env(),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unapproved_port");
  });

  it("8. rejects HTTP downgrade on staging policy (requires https)", async () => {
    const r = await validateArcBaseUrl("http://staging.example:443", {
      env: env({
        ARC_BASE_URL_POLICY: "staging_allowlist",
        ARC_BASE_URL_ALLOWLIST: "staging.example",
      }),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unexpected_scheme");
  });

  it("9. redirect destination not followed by policy (curl --max-redirs 0) + unauthorized host denied", async () => {
    /* Enforcement: validator denies non-allowlisted hosts; script uses --max-redirs 0 */
    const r = await validateArcBaseUrl("http://127.0.0.1:8787/redirect", {
      env: env(),
      resolveDns: false,
    });
    assert.equal(r.ok, false); /* path not allowed on base */
  });

  it("10. DNS rebinding: hostname allowlisted structurally but resolves to public IP → DENY", async () => {
    const r = await validateArcBaseUrl("http://localhost:8787", {
      env: env(),
      dnsLookup: async () => ["93.184.216.34"],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unauthorized_resolved_ip");
  });

  it("11. proxy environment override → DENY", async () => {
    const r = await validateArcBaseUrl("http://127.0.0.1:8787", {
      env: env({ HTTP_PROXY: "http://proxy.evil:8080" }),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "proxy_env_present");
    assert.ok(proxyEnvPresent(env({ HTTPS_PROXY: "x" })).length > 0);
  });

  it("12. cloud metadata destination → DENY", async () => {
    const r = await validateArcBaseUrl("http://169.254.169.254:8787", {
      env: env({ ARC_BASE_URL_ALLOW_ANY_LOOPBACK_PORT: "true" }),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.reason === "cloud_metadata" || r.reason === "unauthorized_hostname");
  });

  it("13. malformed URL → DENY", async () => {
    const r = await validateArcBaseUrl("not a url", { env: env(), resolveDns: false });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "malformed_url");
  });

  it("14. missing allowlist under staging policy → DENY", async () => {
    const r = await validateArcBaseUrl("https://staging.example", {
      env: env({ ARC_BASE_URL_POLICY: "staging_allowlist" }),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "missing_allowlist");
  });

  it("15. empty authorization still dry-runs (script gate) — BASE_URL default valid", async () => {
    const r = await validateArcBaseUrl("http://127.0.0.1:8787", {
      env: env(),
      resolveDns: false,
    });
    assert.equal(r.ok, true);
    const script = spawnSync("bash", [join(root, "scripts/arc-live-validation.sh")], {
      env: { ...process.env, ARC_LIVE_VALIDATION_AUTHORIZED: "false" },
      encoding: "utf8",
    });
    assert.equal(script.status, 0);
    assert.match(script.stdout + script.stderr, /AUTHORIZATION REQUIRED|Dry-run complete/);
  });

  it("16. invalid authorization value does not unlock live path", async () => {
    const script = spawnSync("bash", [join(root, "scripts/arc-live-validation.sh")], {
      env: {
        ...process.env,
        ARC_LIVE_VALIDATION_AUTHORIZED: "yes",
        ARC_BASE_URL: "http://127.0.0.1:8787",
      },
      encoding: "utf8",
    });
    assert.equal(script.status, 0);
    assert.match(script.stdout + script.stderr, /AUTHORIZATION REQUIRED/);
  });

  it("17. unauthorized production target → DENY", async () => {
    const r = await validateArcBaseUrl("https://adalah.ai", {
      env: env({
        ARC_BASE_URL_POLICY: "staging_allowlist",
        ARC_BASE_URL_ALLOWLIST: "adalah.ai",
      }),
      resolveDns: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "production_target");
  });

  it("18. AI agent cannot expand allowlist via permissions", () => {
    assert.equal(roleHasPermission("ai_agent", "credentials:modify"), false);
    assert.equal(roleHasPermission("ai_agent", "policy:modify"), false);
    assert.equal(roleHasPermission("ai_agent", "deployment:execute"), false);
    /* Allowlist is env-admin only — no API to mutate ARC_BASE_URL_ALLOWLIST */
  });

  it("valid local fixture access remains functional", async () => {
    const r = await validateArcBaseUrl("http://127.0.0.1:8787", {
      env: env(),
      resolveDns: false,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.normalized, "http://127.0.0.1:8787");
      assert.equal(r.policy, "loopback");
    }
    const sync = validateArcBaseUrlSync("http://127.0.0.1:8787", env());
    assert.equal(sync.ok, true);
  });

  it("CLI validator rejects public URL (exit 1)", () => {
    const r = spawnSync(
      "pnpm",
      ["exec", "tsx", "scripts/validate-base-url.ts", "http://evil.example:8787"],
      { cwd: root, encoding: "utf8", env: env() },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ARC_BASE_URL_DENIED/);
  });

  it("CLI validator accepts loopback (exit 0)", () => {
    const r = spawnSync(
      "pnpm",
      ["exec", "tsx", "scripts/validate-base-url.ts", "http://127.0.0.1:8787"],
      { cwd: root, encoding: "utf8", env: env() },
    );
    assert.equal(r.status, 0);
    assert.match(r.stdout.trim(), /^http:\/\/127\.0\.0\.1:8787$/);
  });

  it("authorized path refuses evil BASE_URL before curl", () => {
    const r = spawnSync("bash", [join(root, "scripts/arc-live-validation.sh")], {
      encoding: "utf8",
      env: {
        ...env(),
        ARC_LIVE_VALIDATION_AUTHORIZED: "true",
        ARC_BASE_URL: "http://evil.example:8787",
        PATH: process.env.PATH,
        HOME: process.env.HOME,
      },
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /validation FAILED|ARC_BASE_URL_DENIED/);
  });

  it("preserves Coolify mutation deny + F-001/F-002 permission invariants", () => {
    assert.equal(coolifyAdapter.capabilities().executeDeploy, false);
    assert.equal(roleHasPermission("platform_owner", "deployment:execute"), false);
    assert.equal(roleHasPermission("ai_agent", "deployment:request"), false);
    assert.equal(roleHasPermission("ai_agent", "approval:decide"), false);
  });

  it("rejects query/fragment/control chars/https-on-loopback", async () => {
    assert.equal(
      (
        await validateArcBaseUrl("http://127.0.0.1:8787?x=1", {
          env: env(),
          resolveDns: false,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await validateArcBaseUrl("http://127.0.0.1:8787#frag", {
          env: env(),
          resolveDns: false,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await validateArcBaseUrl("http://127.0.0.1:8787\n", {
          env: env(),
          resolveDns: false,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await validateArcBaseUrl("https://127.0.0.1:8787", {
          env: env(),
          resolveDns: false,
        })
      ).ok,
      false,
    );
  });

  it("staging allowlist accepts only listed https host (no DNS in this unit)", async () => {
    const r = await validateArcBaseUrl("https://arc-staging.test", {
      env: env({
        ARC_BASE_URL_POLICY: "staging_allowlist",
        ARC_BASE_URL_ALLOWLIST: "arc-staging.test",
      }),
      resolveDns: false,
    });
    assert.equal(r.ok, true);
  });
});
