---
name: Adala analytics SQL safety
description: How analytics.ts handles period-based date filtering without sql.raw()
---

## Rule
Never use `sql.raw()` for INTERVAL expressions — even with a whitelist. SAST scanners flag them regardless.

## Pattern used
`periodStartDate(period: string): string` computes a `Date` in JS, returns `.toISOString()`.
Each route does `const startDate = periodStartDate(period);` then uses `${startDate}::timestamptz` in queries.

**Why:** SAST scanner (even with whitelisted values from `periodInterval()`) flags sql.raw as HIGH severity. Parameterized dates are both cleaner and bypass the scanner entirely.

**How to apply:** Any new analytics route that needs a time window should call `periodStartDate()` and embed the result as a query parameter, not construct an INTERVAL string.
