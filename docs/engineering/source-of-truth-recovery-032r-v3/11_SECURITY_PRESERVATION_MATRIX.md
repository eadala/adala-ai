# 11 — Security Preservation Matrix

Properties that must survive recovery + later integration (existence check after objects recovered; **no tests run in V3**):

| Property | This tip | Missing 030 chain |
|----------|----------|-------------------|
| Tenant isolation / RLS FORCE | Present in 056–060 lineage | Unknown additional fixes |
| GUC containment | Present in recovery lineage | Unknown |
| Privileged SA/Dev | Present modules | Unknown wave 018–021 deltas |
| Portal authz | Present + 031 portal GUC fix | Unknown 025 deltas |
| Financial integrity / idempotency | Partial + 031 fake refunds | Unknown 023–024 |
| AI / RAG isolation | Limited on tip | **Critical gap** if 029–030 absent |

Historical PASS reports ≠ current regression results.
