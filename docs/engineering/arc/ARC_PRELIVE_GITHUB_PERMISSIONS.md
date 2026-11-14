# ARC Pre-Live GitHub App Permission Certification

**Code:** `adapters/githubApp.ts`, `adapters/github.ts`, `adapters/httpSafe.ts`

## API operations

| Operation | Method | Justification |
|---|---|---|
| Repository/PR/check/commit/release reads | **GET** | Evidence collection via `safeFetchJson` |
| Installation token mint | **POST** `/app/installations/{id}/access_tokens` | Required GitHub App token exchange; not a repository mutation; hardcoded `api.github.com`; mutation flag blocks acquisition |

No workflow dispatch, merge, release publish, or settings APIs present.

## Permission sufficiency / least privilege

Proposed read-only set (Contents, Metadata, Pull requests, Checks, Actions, Commit statuses) is **sufficient** for ARC evidence and **not excessive** relative to stated purposes. Forbidden write/admin list documented.

## Mandatory controls

| Control | Verdict |
|---|---|
| Read-only permissions | PASS (spec + forbidden list) |
| Repository allowlisting | PASS |
| Fixed API origin | PASS (`https://api.github.com`) |
| TLS | PASS (https only for GitHub) |
| Timeouts | PASS (8s) |
| Rate-limit handling | PASS (simulated + degraded) |
| Pagination limits | PASS (≤50) |
| Token redaction | PASS |
| No repo mutation / merge / release / settings | PASS (no code paths) |

GET semantic review: endpoints used are informational reads; no state-changing GET semantics identified for chosen paths.

## Findings

| ID | Severity | Issue |
|---|---|---|
| F-PRELIVE-006 | INFORMATIONAL | `fetchInstallationToken` uses raw `fetch` (not `safeFetchJson`) but URL is constant-origin constructed; installation id from env — acceptable if env is admin-controlled. |

## Verdict

**PASS** — App not installed; live verification NOT GRANTED.
