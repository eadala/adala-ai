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

## Proposed interim (pending approval)

- **Non-prod RPO target:** 24h (Option A) until measured dump reliability and staging exist
- **Production RPO:** **UNDECIDED** — must be set before production GO
- **Do not claim** achieved RPO/RTO from local drills alone

## Sign-off fields

| Role | Choice (A/B/C) | Max RPO | Date | Signature |
|------|----------------|---------|------|-----------|
| Product / business owner | | | | |
| Engineering lead | | | | |
| Security / compliance | | | | |
