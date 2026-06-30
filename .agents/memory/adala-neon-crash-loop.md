---
name: Adala Neon DB crash loop
description: Neon DB hibernation sends 57P01 → uncaughtException → process.exit(1) → crash loop → publish fails
---

## The Problem
Neon DB (serverless PostgreSQL) regularly hibernates idle connections and sends:
- Error code `57P01` — "terminating connection due to administrator command"

This arrives as an uncaught exception. The original handler did:
```ts
process.on("uncaughtException", (err) => {
  logger.error(...)
  setTimeout(() => process.exit(1), 500); // ← WRONG for DB errors
});
```

This caused a **crash loop**:
1. Neon terminates connection
2. Server crashes (`process.exit(1)`)
3. Process restarts
4. Healthcheck `/api/healthz` returns 500 during startup
5. Publish promote step fails → "merge failed" error in UI
6. Site stays on old build

## The Fix (in `artifacts/api-server/src/index.ts`)
Added `isRecoverableDbError()` that catches codes: `57P01`, `57014`, `08006`, `08001`, `08P01`, `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, and message substrings like "terminating connection".

Both `uncaughtException` and `unhandledRejection` handlers now:
- Return (no exit) for recoverable DB errors
- Only call `process.exit(1)` for truly fatal errors

**Why:** The Drizzle/pg connection pool reconnects automatically on the next query. No need to crash — just warn and let the pool recover.

## How to Apply
Any time the production server shows `57P01` in crash logs + healthcheck 500 loop, check `src/index.ts` process handlers. The fix must be deployed (new publish) to take effect.
