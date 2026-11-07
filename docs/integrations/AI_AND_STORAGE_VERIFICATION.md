# AI and Storage Verification

## Storage / R2

| Check | Status |
|-------|--------|
| Signed-url route + `requireAuthWithTenant` | **VERIFIED** code; `test:storage-signed-open` in suite |
| Live R2 upload/download | **NOT EXECUTED** (no R2 secrets) |
| Cross-office object IDOR | **NOT EXECUTED** live; prior contract tests exist |
| Reopen signed-open | **No new regression evidence** — do not modify |

## AI / Gemini

| Check | Status |
|-------|--------|
| Server-side key usage | Code paths present |
| Live Gemini call | **NOT EXECUTED** (`GEMINI_API_KEY` unset) |
| Credit isolation (`office_ai_credits`) | Notifications aggregator now scopes by `office_id`; full AI chat isolation **NOT VERIFIED** E2E |
| Double-debit on retry | **NOT VERIFIED** |
| New providers | **Not introduced** (per mandate) |

## Remaining risk

Human must run staging AI + R2 smoke after secrets configured.
