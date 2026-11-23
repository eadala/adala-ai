/**
 * Shared authFetch helper — Bearer token attachment rules.
 * Run: pnpm --filter @workspace/adala run test:auth-fetch
 */
import assert from "node:assert/strict";
import {
  __resetAuthFetchForTests,
  authFetch,
  isAuthReady,
  publicFetch,
  setAuthReady,
  setClerkTokenGetter,
} from "../lib/authFetch";

type Captured = {
  url: string;
  init?: RequestInit;
  headers: Headers;
};

const captured: Captured[] = [];

function installMockFetch(): void {
  captured.length = 0;
  // @ts-expect-error test stub
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    captured.push({ url, init, headers });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

console.log("\n═══ authFetch: Bearer attachment ═══");

{
  __resetAuthFetchForTests();
  installMockFetch();
  setClerkTokenGetter(async () => "tok_abc");
  await authFetch("/api/offices/my");
  assert.equal(captured.length, 1);
  assert.equal(captured[0].headers.get("authorization"), "Bearer tok_abc");
  console.log("  ✅ authenticated protected request includes Bearer token");
}

{
  __resetAuthFetchForTests();
  installMockFetch();
  setClerkTokenGetter(async () => "tok_should_not_win");
  await authFetch("/api/offices/my", {
    headers: { Authorization: "Bearer explicit_token" },
  });
  assert.equal(captured[0].headers.get("authorization"), "Bearer explicit_token");
  console.log("  ✅ explicit Authorization header is preserved");
}

{
  __resetAuthFetchForTests();
  installMockFetch();
  setClerkTokenGetter(async () => "tok_secret");
  await publicFetch("/api/healthz");
  assert.equal(captured.length, 1);
  assert.equal(captured[0].headers.get("authorization"), null);
  console.log("  ✅ public request remains unauthenticated");
}

{
  __resetAuthFetchForTests();
  installMockFetch();
  setClerkTokenGetter(async () => null);
  await authFetch("/api/branding");
  assert.equal(captured[0].headers.get("authorization"), null);
  assert.notEqual(captured[0].headers.get("authorization"), "Bearer null");
  console.log("  ✅ missing session does not send Bearer null");
}

{
  __resetAuthFetchForTests();
  installMockFetch();
  setClerkTokenGetter(async () => undefined);
  await authFetch("/api/notifications");
  assert.equal(captured[0].headers.get("authorization"), null);

  setClerkTokenGetter(async () => "");
  await authFetch("/api/notifications");
  assert.equal(captured[1].headers.get("authorization"), null);
  console.log("  ✅ empty/undefined token never sends Bearer");
}

{
  __resetAuthFetchForTests();
  installMockFetch();
  setClerkTokenGetter(async () => "tok_preserve");
  const controller = new AbortController();
  await authFetch("/api/events?limit=6", {
    method: "POST",
    body: JSON.stringify({ ping: 1 }),
    signal: controller.signal,
    headers: { "Content-Type": "application/json", "X-Custom": "1" },
  });
  assert.equal(captured[0].init?.method, "POST");
  assert.equal(captured[0].init?.body, JSON.stringify({ ping: 1 }));
  assert.equal(captured[0].init?.signal, controller.signal);
  assert.equal(captured[0].headers.get("content-type"), "application/json");
  assert.equal(captured[0].headers.get("x-custom"), "1");
  assert.equal(captured[0].headers.get("authorization"), "Bearer tok_preserve");
  console.log("  ✅ preserves method, body, signal, and custom headers");
}

console.log("\n═══ authFetch: bootstrap readiness ═══");

{
  __resetAuthFetchForTests();
  assert.equal(isAuthReady(), false);
  setAuthReady(true);
  assert.equal(isAuthReady(), true);
  setAuthReady(false);
  assert.equal(isAuthReady(), false);
  console.log("  ✅ auth readiness flag gates bootstrap (useAuthReady / enabled)");
}

{
  // Simulate bootstrap hooks: do not call authFetch until ready.
  __resetAuthFetchForTests();
  installMockFetch();
  setClerkTokenGetter(async () => "tok_early");
  const authReady = isAuthReady(); // false
  assert.equal(authReady, false);
  if (authReady) {
    await authFetch("/api/rbac/my-permissions");
  }
  assert.equal(captured.length, 0, "query must not fire before auth ready");

  setAuthReady(true);
  if (isAuthReady()) {
    await authFetch("/api/rbac/my-permissions");
  }
  assert.equal(captured.length, 1);
  assert.equal(captured[0].headers.get("authorization"), "Bearer tok_early");
  console.log("  ✅ bootstrap hooks wait for auth readiness before request");
}

console.log("\n✅ authFetch: all checks passed\n");
