# Baseline Verification — ADALA-PLATFORM-RELIABILITY-GATE-009

| Check | Result |
|-------|--------|
| Branch at start | `cursor/platform-reliability-p0-da81` |
| Expected HEAD | `16518de741a83e52f509613a38435a2ed2c05337` |
| Expected tree | `4b8ac3b4dd9af6a530094660638dd1540a6c366a` |
| Match | YES |
| Working tree (pre-gate) | Clean |
| Tenant baseline ancestor | `d2f7e369…` ⊆ HEAD |
| Assurance tip ancestor | `1f5534b9…` ⊆ HEAD |
| Gate working branch | `cursor/platform-reliability-gate-009-da81` (from verified tip) |

Existing commands reused: `test:tenant-isolation-gate`, `test:platform-reliability`, root `Dockerfile` with `--frozen-lockfile`.

Prior backup/restore evidence retained under `docs/engineering/platform-reliability/evidence/`.
