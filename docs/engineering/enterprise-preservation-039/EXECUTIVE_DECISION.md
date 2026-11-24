# Executive Decision — ADALA-039

**FINAL_DECISION:** `BLOCKED_BY_SENSITIVE_CONTENT`

## Why

Gate B reclassified `docs/engineering/forensic-git-recovery-032r/evidence/baseline-capture.txt` as **CONFIRMED_SECRET** (unmasked GitHub `ghs_` length-48 + JWT-shaped material) on the **master checkpoint** ancestry.

Per Gate B: remote transfer of any ref that reaches that blob is **blocked**.

## What still succeeded locally

| Gate | Result |
|------|--------|
| A Pre-flight | `LOCAL_BASELINE_VERIFIED` |
| B Secret scan | Complete — 1 CONFIRMED_SECRET (local checkpoint); Phase 031 tree **clean** of that file |
| C Private repo | **Not created** — no explicit create authorization; `gh` API 403 for user identity |
| D Ref mapping | Designed (`backup/*` only) |
| E Encrypted bundle | Phase-031-only plaintext + AES-256-CBC ciphertext created under `/tmp`; key custody outside repo; local decrypt+restore OK |
| F Deploy isolation | Coolify UNKNOWN; public origin untouched |
| G Transfer | NOT AUTHORIZED / BLOCKED by sensitive content for checkpoint scope |
| H Off-env restore | NOT_PERFORMED |
| I Continuity design | Documented |
| J Recovery path | PATH_C after durable backup of **sanitized** scope |

**Phase 031-only** export is the approved *candidate* sanitized scope after Gate C+G authorizations (separate).
