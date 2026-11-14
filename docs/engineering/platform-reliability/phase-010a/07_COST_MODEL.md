# Cost Model (Assumptions Explicit)

**Status:** ESTIMATE ONLY — refine after first measured dump in 010-B.

## Assumptions

| Assumption | Value | Source |
|------------|-------|--------|
| Dump frequency | 1 full logical / day | Proposed ops policy |
| Retention | 30 days | Draft retention |
| Average dump size | **5 GB** | Placeholder — **unmeasured** |
| Provider storage | ~$0.015 / GB-month (illustrative R2-class) | Public list price ballpark; confirm contract |
| Egress per restore drill | 5 GB | One full download |
| Drills / month | 2 | Proposed |
| Class A/B ops | Negligible vs storage for this scale | Rough |

## Monthly storage estimate

`30 objects × 5 GB = 150 GB-month`  
`150 × $0.015 ≈ $2.25 / month` storage (illustrative)

## Monthly drill egress estimate

`2 × 5 GB` download — price depends on provider egress policy (R2 often $0 egress to internet; confirm).

## Cost risks

- Dump size much larger than 5 GB (wide variance by tenant data)
- Retaining evidence + multiple failed partial uploads
- Enabling Object Lock without expiry discipline
- Accidentally backing up document blobs into dump path

## Control

- Measure real dump size in first 010-B synthetic-then-nonprod-DB drill
- Cap retention at 30 days until finance approves higher
- Separate document storage billing from backup prefix
