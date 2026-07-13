/**
 * Cold-start helper for metrics vitals Production-chain integration test.
 * Prints READY:<port> when listening.
 */
process.env.DATABASE_URL ??= "postgresql://mock:mock@127.0.0.1:5432/mock";
process.env.NODE_ENV = "production";
process.env.CLERK_PUBLISHABLE_KEY ??= "pk_test_not_valid_for_clerk_parser";
process.env.CLERK_SECRET_KEY ??= "sk_test_not_valid";

import http from "node:http";

const { db } = await import("@workspace/db");
(db as { execute: typeof db.execute }).execute = ((async () => ({ rows: [] })) as unknown) as typeof db.execute;

const { default: app } = await import("../app");

const server = http.createServer(app);
await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve());
});
const addr = server.address();
const port = typeof addr === "object" && addr ? addr.port : 0;
console.log(`READY:${port}`);
