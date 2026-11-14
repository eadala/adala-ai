# ARC Phase 2A Audit Durability

## Implementation

- Path: `ARC_AUDIT_PATH` or `artifacts/arc-server/data/audit.jsonl`
- Mode: append-only newline-delimited JSON
- File mode hint: `0o600`
- Loads existing lines on process start
- DELETE/PATCH/PUT `/audit/:id` → **403**

## Verified

Unit test creates temp store, appends event, constructs second store on same path, finds event (restart simulation).

## Integrity limitations (documented — not WORM)

- No cryptographic hash chain
- Local filesystem can be truncated by OS user
- `immutabilityClaim: false`, `integrityEnforced: false`

## Residual risk

MEDIUM residual for compliance-grade audit until PR-03 dedicated DB + stronger integrity controls. Acceptable for Phase 2A local foundation.
