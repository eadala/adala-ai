/**
 * Cold-start helper for frontendStatic.prodApp.integration.test.ts
 */
process.env.DATABASE_URL ??= "postgresql://mock:mock@127.0.0.1:5432/mock";
process.env.NODE_ENV = "production";
// Well-formed pk_test so Clerk middleware can parse without throwing Publishable key not valid.
process.env.CLERK_PUBLISHABLE_KEY ??=
  "pk_test_" + Buffer.from("clerk.adalahai.com$").toString("base64url");
process.env.CLERK_SECRET_KEY ??= "sk_test_not_valid";

import http from "node:http";

const { db } = await import("@workspace/db");
(db as { execute: typeof db.execute }).execute = ((async () => ({
  rows: [],
})) as unknown) as typeof db.execute;

const { default: app } = await import("../app");

const server = http.createServer(app);
await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve());
});
const addr = server.address();
const port = typeof addr === "object" && addr ? addr.port : 0;
console.log(`READY:${port}`);
