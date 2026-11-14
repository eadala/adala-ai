# Baseline & Test Deduplication Ledger

## Baseline integrity

| Check | Result |
|---|---|
| Repo | eadala/adala-ai (`/workspace`) |
| Assessment branch | `cursor/saas-engineering-assurance-da81` (created from tip) |
| Security remediation HEAD | `22a28a5d1608d8eb0ded75b258e5ea0b615b5905` |
| Security remediation tree | `149c3a1ae0aaeacf46229daf28c093a85b7a48f2` |
| Ancestry | `git merge-base --is-ancestor 22a28a5d HEAD` → OK |
| Tip at branch create | `d2f7e3695a3a1d37b9e091e4525deb18fa087c07` |
| Tip tree | `4f13f329ac29eba828f3fad2409c4c2752849a3f` |
| Delta vs security SHA | Local P0-006 runtime-assurance commits present; not discarded |
| Uncommitted at start | Clean after P0-006 commits |
| Push/reset/merge | None |

## Coverage ledger (non-duplication)

| Existing test ID / evidence | Covered security invariant | New operational risk under 007 | Why not duplicative |
|---|---|---|---|
| F-TENANT-OFFICE-IDOR-001 / P0-005+006 HTTP | Cross-office IDOR deny | N/A | Not re-run |
| F-TENANT-PAYMENTS-LIST-001 | Payment list tenant scope | Payment provider timeout/retry storms | Reliability of payment **ops**, not isolation |
| F-TENANT-RESOLVER-TRACE-001 | Header/membership resolution | Auth provider outage UX | Clerk timeout ≠ tenant forge |
| F-TENANT-AI-CREDITS-001 | Credit body forge | AI cost amplification / quota exhaustion | Unit economics |
| F-TENANT-AI-AGENT-UNSCOPED-001 | Agent log scope | AI orchestration latency/error budget | Performance/SRE |
| F-TENANT-POOL-001 GUC | GUC leak on release | Pool **size/timeout/saturation** | Capacity, not GUC |
| Migration 061 RLS FORCE | Owner bypass | Migration apply duration/locks | Perf of migrate, not policy |
| WhatsApp isolation P0-006 | Phone→office ownership | Provider rate-limit / webhook backlog | Async reliability |
| Cron withSystemDbScope | Privileged cron GUC | Overlap locks multi-replica / job durability | Ops correctness |
| ARC deployment disabled docs | Deploy execute 403 | Release provenance / Coolify promotion | Release engineering |
| Static schema tests CI | Schema authority | Load/soak/DR absent from CI | Gap analysis |

## Explicitly avoided

Re-running HTTP adversarial tenant matrix, RLS attack suite, WhatsApp cross-tenant status, AI credit cross-body, pool GUC bypass tests.
