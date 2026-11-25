/**
 * Layer 2 — real Express `app` production chain + PUBLIC_DIR assets + CORS Origin.
 * Cold-starts the actual application module (not a miniature stand-in).
 *
 * Run: pnpm --filter @workspace/api-server run test:frontend-static-prod
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_HELPER = join(HERE, "frontendStatic.prodApp.server.ts");

const publicDir = mkdtempSync(join(tmpdir(), "adala-prod-public-"));
mkdirSync(join(publicDir, "assets"));
writeFileSync(
  join(publicDir, "index.html"),
  `<!doctype html><html><head>
<link rel="stylesheet" crossorigin href="/assets/boot.css">
<script type="module" crossorigin src="/assets/boot.js"></script>
</head><body><div id="root">loading</div></body></html>`,
);
writeFileSync(join(publicDir, "assets", "boot.js"), "window.__BOOT__=true");
writeFileSync(join(publicDir, "assets", "boot.css"), "html{background:#111}");
writeFileSync(join(publicDir, "favicon.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
// Sensitive file that must never be served
writeFileSync(join(publicDir, ".env"), "CLERK_SECRET_KEY=sk_test_SHOULD_NOT_LEAK\n");

async function waitForPort(child: ReturnType<typeof spawn>, timeoutMs = 45_000) {
  const lines: string[] = [];
  return new Promise<{ port: number; lines: string[] }>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`server start timeout\n${lines.join("\n")}`)),
      timeoutMs,
    );
    if (!child.stdout) {
      clearTimeout(timer);
      reject(new Error("no stdout"));
      return;
    }
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      lines.push(line);
      const m = line.match(/^READY:(\d+)$/);
      if (m) {
        clearTimeout(timer);
        resolve({ port: Number(m[1]), lines });
      }
    });
    child.stderr?.on("data", (buf) => lines.push(String(buf)));
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early code=${code}\n${lines.join("\n")}`));
    });
  });
}

console.log("\n═══ real app: production NODE_ENV + staging Origin assets ═══");

const child = spawn(process.execPath, ["--import", "tsx", SERVER_HELPER], {
  cwd: join(HERE, "../.."),
  env: {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://mock:mock@127.0.0.1:5432/mock",
    CLERK_PUBLISHABLE_KEY:
      "pk_test_" + Buffer.from("clerk.adalahai.com$").toString("base64url"),
    CLERK_SECRET_KEY: "sk_test_not_valid",
    PUBLIC_DIR: publicDir,
    ALLOWED_ORIGINS: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let exitCode = 1;
try {
  const { port } = await waitForPort(child);
  const base = `http://127.0.0.1:${port}`;

  async function get(path: string, origin?: string) {
    const headers: Record<string, string> = {
      Host: "staging.adalahai.com",
      "X-Forwarded-Host": "staging.adalahai.com",
      "X-Forwarded-Proto": "https",
    };
    if (origin) headers.Origin = origin;
    const res = await fetch(`${base}${path}`, { headers });
    return {
      status: res.status,
      type: res.headers.get("content-type") || "",
      body: await res.text(),
    };
  }

  const html = await get("/");
  assert.equal(html.status, 200, `html ${html.status} ${html.body.slice(0, 100)}`);
  assert.match(html.type, /html/);

  const js = await get("/assets/boot.js", "https://staging.adalahai.com");
  assert.equal(js.status, 200, `js ${js.status} ${js.body.slice(0, 160)}`);
  assert.match(js.type, /javascript|ecmascript/);
  assert.equal(js.body, "window.__BOOT__=true");
  assert.doesNotMatch(js.body, /CORS_ORIGIN_NOT_ALLOWED|auth_blocked/);

  const css = await get("/assets/boot.css", "https://staging.adalahai.com");
  assert.equal(css.status, 200, `css ${css.status} ${css.body.slice(0, 160)}`);
  assert.match(css.type, /text\/css/);

  const evil = await get("/assets/boot.js", "https://evil.example");
  assert.equal(evil.status, 403);
  assert.match(evil.body, /CORS_ORIGIN_NOT_ALLOWED/);

  const envLeak = await get("/.env", "https://staging.adalahai.com");
  assert.equal(envLeak.status, 404);
  assert.doesNotMatch(envLeak.body, /SHOULD_NOT_LEAK|CLERK_SECRET/);

  const api = await get("/api/cases", "https://staging.adalahai.com");
  assert.ok(api.status === 401 || api.status === 403, `api status=${api.status}`);
  assert.match(api.type, /json/);

  console.log("  ✅ real app serves staging Origin assets; secrets blocked; API still auth-gated");
  exitCode = 0;
} finally {
  child.kill("SIGTERM");
  rmSync(publicDir, { recursive: true, force: true });
}

process.exit(exitCode);
