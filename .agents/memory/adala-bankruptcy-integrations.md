---
name: Adala Bankruptcy Integrations
description: Phase 1-3 cross-module wiring — AI credits, Telegram, Storage, EventBus, Audit, Finance for the Bankruptcy module
---

## callAI was called with wrong parameter order

**Rule:** `callAI(sys, msg, history=[], model="auto", officeId="default", queryType, userId)` — passing officeId as 3rd arg silently treated it as `history[]`, credits were never deducted.

**Fix:** Use `callBkAI(sys, msg, officeId, queryType)` from `bankruptcyIntegrations.ts` which wraps callAI with the correct param order.

**Why:** The signature has 7 positional args; TypeScript allows passing string where `history` expects `[]` without error because the type check was loose in some callers.

**How to apply:** Any new AI call in bankruptcy/* must use `callBkAI()` not `callAI()` directly.

## V3 eligibility analysis was always falling to fallback

V3 line 287 was calling `callAI(...)` and then `.match()` on the returned `{ reply, modelUsed, tier }` object — always threw, always used static fallback. Fixed by destructuring `{ reply: rawReply }` before `.match()`.

## Telegram per-office lookup

`notifyTelegramCaseStatus()` hardcodes `office_id='default'`. Bankruptcy uses `sendTg()` in `bankruptcyIntegrations.ts` which looks up by specific officeId first, falls back to 'default'.

## Storage integration

`saveReportToStorage()` in `bankruptcyIntegrations.ts` inserts a `storage_files` row after every `bk_reports` INSERT and every court package generation. Idempotent via `file_name` uniqueness check. Category = `"bankruptcy"`. `file_url` points to the API read endpoint.

## 5 Telegram events wired

| Function | Trigger | Severity filter |
|---|---|---|
| `tgBkCaseStatus` | case status PATCH | all |
| `tgBkMeeting` | POST bk_meetings | all |
| `tgBkDistribution` | PUT distribution → approved/executed | approved/executed only |
| `tgBkAlert` | bk_alerts INSERT | critical/high only |
| `tgBkAiAnalysis` | AI analysis complete | all |

All are `void` fire-and-forget to never block HTTP responses.

## Phase 2: EventBus / EDA Integration

5 new EventTypes added to `src/core/eventBus.ts`:
- `BK_CASE_CREATED`, `BK_CASE_CLOSED`, `BK_DISTRIBUTION_EXECUTED`, `BK_CLAIM_APPROVED`, `BK_ALERT_TRIGGERED`

`bkEmit(officeId, type, data, actorId?)` — fire-and-forget wrapper around `eventBus.emit()`.

Wired at: case created, case archived, distribution executed, claim approved.

## Phase 2-B: Global Platform Audit Trail

`auditLogBk(opts)` — wraps `auditLog()` from `src/lib/auditLogger.ts`.
Writes to `audit_logs` (platform-wide) in addition to `bk_audit_logs` (module-local).
Actions named: `bk.case.create`, `bk.case.archive`, `bk.distribution.execute`, `bk.claim.approve`, `bk.distribution.revenue_posted`.

## Phase 3: Finance Auto-posting

`autoPostBkRevenue(opts)` — auto-inserts into `revenues` table when distribution is "executed".
- Default fee = 2% of `total_amount` (Saudi Bankruptcy Law Article 56 guideline)
- Category = "أتعاب قضائية" → maps to Chart-of-Accounts code 4100 automatically
- Idempotent: checks for duplicate via distributionId in notes field before inserting
- Appears in P&L, cash-flow, and financial reports without manual entry
- All in `src/modules/bankruptcy/bankruptcyIntegrations.ts`
