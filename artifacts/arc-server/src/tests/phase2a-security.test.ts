import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { issueDevCredential, issueExpiredDevCredential } from "../lib/identity.js";
import { roleHasPermission } from "../lib/permissions.js";
import { coolifyAdapter } from "../adapters/coolify.js";
import { ArcStore } from "../lib/store.js";

async function listen(): Promise<{ server: Server; base: string }> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  return { server, base: `http://127.0.0.1:${addr.port}` };
}

function bearer(operatorId: string): Record<string, string> {
  const issued = issueDevCredential(operatorId);
  assert.ok("token" in issued);
  return {
    authorization: `Bearer ${issued.token}`,
    "content-type": "application/json",
  };
}

describe("ARC Phase 2A security remediation", () => {
  let server: Server;
  let base: string;

  before(async () => {
    ({ server, base } = await listen());
  });
  after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("1. forged X-ARC-Role is rejected", async () => {
    const h = bearer("auditor");
    const res = await fetch(`${base}/api/arc/deployments/execute`, {
      method: "POST",
      headers: { ...h, "x-arc-role": "production_operator" },
      body: "{}",
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { reason: string };
    assert.equal(body.reason, "role_header_forbidden");
  });

  it("2. missing authentication → 401", async () => {
    const res = await fetch(`${base}/api/arc/deployments/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ releaseId: "rel-guc-rc" }),
    });
    assert.equal(res.status, 401);
  });

  it("3. invalid authentication (bad signature) → 401", async () => {
    const issued = issueDevCredential("operator");
    assert.ok("token" in issued);
    const bad = `${issued.token.slice(0, -4)}XXXX`;
    const res = await fetch(`${base}/api/arc/deployments/request`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bad}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ releaseId: "rel-guc-rc" }),
    });
    assert.equal(res.status, 401);
  });

  it("4. expired authentication → 401", async () => {
    const token = issueExpiredDevCredential("operator");
    const res = await fetch(`${base}/api/arc/deployments/request`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ releaseId: "rel-guc-rc" }),
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { reason: string };
    assert.equal(body.reason, "expired");
  });

  it("5. AI agent deployment request → 403", async () => {
    const res = await fetch(`${base}/api/arc/deployments/request`, {
      method: "POST",
      headers: bearer("agent"),
      body: JSON.stringify({ releaseId: "rel-guc-rc" }),
    });
    assert.equal(res.status, 403);
  });

  it("6. AI agent approval decide → 403", async () => {
    const res = await fetch(`${base}/api/arc/approvals/x/decide`, {
      method: "POST",
      headers: bearer("agent"),
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.equal(res.status, 403);
  });

  it("7. AI agent policy modification → 403", async () => {
    const res = await fetch(`${base}/api/arc/policy`, {
      method: "POST",
      headers: bearer("agent"),
      body: JSON.stringify({ policy: "x" }),
    });
    assert.equal(res.status, 403);
  });

  it("8. human self-approval still rejected", async () => {
    const reqRes = await fetch(`${base}/api/arc/approvals/request`, {
      method: "POST",
      headers: bearer("reviewer"),
      body: JSON.stringify({ releaseId: "rel-guc-rc" }),
    });
    assert.equal(reqRes.status, 403); /* reviewer lacks approval:request */
    const create = await fetch(`${base}/api/arc/approvals/request`, {
      method: "POST",
      headers: bearer("releaser"),
      body: JSON.stringify({ releaseId: "rel-guc-rc" }),
    });
    assert.equal(create.status, 201);
    const { approvalRequest } = (await create.json()) as {
      approvalRequest: { id: string; requestedBy: string };
    };
    /* Cannot self-approve: releaser lacks approval:decide */
    const self = await fetch(`${base}/api/arc/approvals/${approvalRequest.id}/decide`, {
      method: "POST",
      headers: bearer("releaser"),
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.equal(self.status, 403);
  });

  it("9. unauthorized role escalation via legacy headers → rejected", async () => {
    const res = await fetch(`${base}/api/arc/deployments/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-arc-token": "arc-local-dev-token",
        "x-arc-operator": "auditor",
        "x-arc-role": "platform_owner",
      },
      body: JSON.stringify({ releaseId: "rel-guc-rc" }),
    });
    assert.ok(res.status === 401 || res.status === 403);
  });

  it("10. direct API deployment execute denied for platform_owner", async () => {
    const res = await fetch(`${base}/api/arc/deployments/execute`, {
      method: "POST",
      headers: bearer("owner"),
      body: JSON.stringify({ releaseId: "rel-guc-rc" }),
    });
    assert.equal(res.status, 403);
  });

  it("11. deployment endpoint execution disabled for all roles", async () => {
    for (const id of ["owner", "releaser", "reviewer", "operator", "auditor", "agent"]) {
      const res = await fetch(`${base}/api/arc/deployments/execute`, {
        method: "POST",
        headers: bearer(id),
        body: JSON.stringify({ releaseId: "rel-guc-rc" }),
      });
      assert.equal(res.status, 403, id);
    }
  });

  it("12. missing security gates → deploymentAllowed false", async () => {
    const res = await fetch(`${base}/api/arc/gates/rel-guc-rc`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { deploymentAllowed: boolean };
    assert.equal(body.deploymentAllowed, false);
  });

  it("13. invalid release identity → 404", async () => {
    const res = await fetch(`${base}/api/arc/gates/does-not-exist`);
    assert.equal(res.status, 404);
  });

  it("14. concurrent approval requests", async () => {
    const [a, b] = await Promise.all([
      fetch(`${base}/api/arc/approvals/request`, {
        method: "POST",
        headers: bearer("releaser"),
        body: JSON.stringify({ releaseId: "rel-guc-rc" }),
      }),
      fetch(`${base}/api/arc/approvals/request`, {
        method: "POST",
        headers: bearer("releaser"),
        body: JSON.stringify({ releaseId: "rel-guc-rc" }),
      }),
    ]);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
  });

  it("15. audit persistence across restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "arc-audit-"));
    const path = join(dir, "audit.jsonl");
    const s1 = new ArcStore(path);
    s1.appendAudit({
      actor: "test",
      action: "persist.check",
      target: "t",
      requestId: "r1",
      previousState: null,
      newState: "ok",
      evidenceReference: null,
    });
    assert.ok(existsSync(path));
    const s2 = new ArcStore(path);
    assert.ok(s2.getAuditSnapshot().some((e) => e.action === "persist.check"));
    const raw = readFileSync(path, "utf8");
    assert.match(raw, /persist\.check/);
  });

  it("16. unauthorized audit modification → 403", async () => {
    const res = await fetch(`${base}/api/arc/audit/some-id`, {
      method: "DELETE",
      headers: bearer("owner"),
    });
    assert.equal(res.status, 403);
  });

  it("17. production-mode rejects development identity issuer", async () => {
    const prev = process.env.ARC_ENV;
    process.env.ARC_ENV = "production";
    try {
      const res = await fetch(`${base}/api/arc/dev/issue-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operatorId: "owner" }),
      });
      /* isProductionConfig read at request time */
      assert.equal(res.status, 403);
      const body = (await res.json()) as { reason: string };
      assert.equal(body.reason, "production_blocks_dev_issuer");
    } finally {
      if (prev === undefined) delete process.env.ARC_ENV;
      else process.env.ARC_ENV = prev;
    }
  });

  it("18. Coolify mutation prevention — executeDeploy false", () => {
    assert.equal(coolifyAdapter.capabilities().executeDeploy, false);
  });

  it("AI agent cannot modify roles or credentials", async () => {
    assert.equal(
      (
        await fetch(`${base}/api/arc/roles`, {
          method: "POST",
          headers: bearer("agent"),
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${base}/api/arc/credentials`, {
          method: "POST",
          headers: bearer("agent"),
          body: "{}",
        })
      ).status,
      403,
    );
  });

  it("permission matrix never grants deployment:execute", () => {
    for (const role of [
      "platform_owner",
      "release_manager",
      "independent_reviewer",
      "production_operator",
      "read_only_auditor",
      "ai_agent",
    ] as const) {
      assert.equal(roleHasPermission(role, "deployment:execute"), false);
    }
  });

  it("legacy X-ARC-Token alone cannot authorize", async () => {
    const res = await fetch(`${base}/api/arc/audit`, {
      headers: {
        "x-arc-token": "arc-local-dev-token",
        "x-arc-operator": "auditor",
      },
    });
    assert.ok(res.status === 401 || res.status === 403);
  });
});
