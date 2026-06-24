---
name: Adala Bankruptcy Integrations
description: Phase 1 cross-module wiring — AI credits, Telegram, Storage for the Bankruptcy module
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
