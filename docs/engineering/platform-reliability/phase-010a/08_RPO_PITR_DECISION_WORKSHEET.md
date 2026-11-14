# RPO / PITR Decision Worksheet

**Important:** Absence of PITR is **not** automatic platform failure. It means recovery may be limited to the **last completed logical backup**.

## Current verified capability (post-009)

| Capability | Status |
|------------|--------|
| Full logical restore from `pg_dump -Fc` | Demonstrated locally |
| Incremental / physical base backup | Not implemented |
| WAL archiving + PITR | **Not available** |
| App process recovery | Demonstrated locally |
| Live object-storage restore | Pending 010-B |

## Decision required from owners

**Question:** What is the maximum acceptable data-loss window (RPO) for Adalah AI non-prod and later production?

| Option | Typical RPO | Architecture | When to choose |
|--------|-------------|--------------|----------------|
| A. Daily logical only | ≤ 24h (if dump succeeds) | Keep current path | Acceptable for early non-prod / low change rate |
| B. Logical every N hours | ≤ N hours | Increase cron frequency + storage cost | Need tighter RPO without WAL ops burden |
| C. WAL + PITR | Minutes (if archiving healthy) | Managed Postgres continuous archive + restore tests | Hard RPO << dump interval; regulated recovery |

## Phase decisions (as of 010-B limited-authorization DRAFT)

- **Phase 010-B scope:** Option **A** — logical backup used only to validate the storage-and-restore workflow (see `12_PHASE_010B_LIMITED_AUTHORIZATION_DRAFT.md`). This is a **test-scope** choice, not a signed production RPO.
- **Production RPO:** **UNDECIDED** — must be set before production GO.
- **WAL/PITR:** separate architecture decision and authorization; **not** in 010-B scope.
- **Do not claim** achieved RPO/RTO from local drills or from an unapproved 010-B draft.

### Mapping note (assessment vs Cursor options)

| Assessment proposal | Cursor option |
|---------------------|---------------|
| 24h daily logical | ≈ A |
| ~1h without requiring WAL | ≈ B with N=1 |
| ~5 minutes | ≈ C (WAL + PITR) |

A design target of ≤1h for critical operational data remains a **recommendation only** until owners sign the matrix.

## Sign-off fields

| Role | Choice (A/B/C) | Max RPO | Date | Signature |
|------|----------------|---------|------|-----------|
| Product / business owner | | | | |
| Engineering lead | | | | |
| Security / compliance | | | | |
