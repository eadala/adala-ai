# Trial Smoke Test — Adalah AI

**Environment:** staging / trial only (`trial.*`)  
**Build under test (SHA):** ________  
**Tester:** ________  
**Date (Asia/Riyadh):** ________  

Mark each row: **PASS** / **FAIL** / **BLOCKED**.  
Any **Critical FAIL** = **No-Go**.

## A. Platform up (Critical)

| # | Step | Expected | Result | Notes |
|---|------|----------|--------|-------|
| A1 | Open trial URL over HTTPS | Page loads, valid cert | | |
| A2 | Hard refresh / cold load | No blank white screen | | |
| A3 | API health / status endpoint (if exposed) | 200 / healthy | | |
| A4 | Browser console (optional) | No flood of hard errors | | |

## B. Auth (Critical)

| # | Step | Expected | Result | Notes |
|---|------|----------|--------|-------|
| B1 | Sign-in with test Clerk user | Lands in app | | |
| B2 | Sign-out | Session cleared | | |
| B3 | Sign-in again | Works | | |
| B4 | Unauthorized deep link | Redirect / 401 — no data leak | | |

## C. Core office path (Critical)

| # | Step | Expected | Result | Notes |
|---|------|----------|--------|-------|
| C1 | See office / workspace entry | Loads | | |
| C2 | Create or open office | Persists after refresh | | |
| C3 | Navigate primary sidebar items | No 500 pages | | |

## D. Legal core slice (Critical)

| # | Step | Expected | Result | Notes |
|---|------|----------|--------|-------|
| D1 | Create one case (or primary entity) | Saved, visible in list | | |
| D2 | Open case detail | Fields readable | | |
| D3 | Add a short note/comment if available | Saved | | |

## E. Documents (Critical)

| # | Step | Expected | Result | Notes |
|---|------|----------|--------|-------|
| E1 | Open documents area | Loads | | |
| E2 | Upload small PDF/PNG (<2MB) | Success | | |
| E3 | Open / download uploaded file | Works | | |

## F. Payments / billing (Non-critical for v0 — must not charge)

| # | Step | Expected | Result | Notes |
|---|------|----------|--------|-------|
| F1 | Open billing UI if present | Test mode or disabled | | |
| F2 | Confirm no Live Stripe keys | Test/sk_test or hidden | | |

## G. Isolation sanity (Critical)

| # | Step | Expected | Result | Notes |
|---|------|----------|--------|-------|
| G1 | Second test user (if available) | Cannot see first office data | | |
| G2 | Confirm hostname is trial, not `adalahai.com` prod | Correct host | | |

## H. Operator evidence

| # | Evidence | Attached? |
|---|----------|-----------|
| H1 | Coolify deployed SHA screenshot | |
| H2 | Smoke wall-clock duration | |
| H3 | Failures filed (issue/PR links) | |

## Sign-off

| Role | Name | Go / No-Go | Signature |
|------|------|------------|-----------|
| Tester | | | |
| Engineer | | | |
| Product owner | | | |

**Final:** GO / NO-GO
