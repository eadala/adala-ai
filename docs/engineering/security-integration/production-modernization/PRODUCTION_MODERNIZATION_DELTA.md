# Production Modernization Delta

## Anchors

| Anchor | SHA | Role |
|---|---|---|
| Production (claimed) | UNVERIFIED | — |
| Documented prod track tip | `c9667a0b` (`main`) | Includes migrations 053–057 |
| Develop | `478be04a` | +#164 only vs prior develop |
| Frozen RC | `54415233` / tree `cd84a7f2` | Preserve |
| Local RC candidate | `5ca2a2e9` / tree `bd9e3750` | develop+#166–182+#185+#183-fix |

## Change inventory (security-relevant)

| Change | Class | State vs main | Include in next release? |
|---|---|---|---|
| Migrations 053–057 on main | P0 DB | On main | Assume prod must align if not already — UNVERIFIED applied |
| #164 fail-closed Stripe/AI/login/messages | P0 | On develop only | **YES** |
| #166–#181 cohesion batches | P0/P1 | Open on develop | **YES** (minimum security set) |
| #182 Batch19 revenues/autopilot/AI | P0 | Open | **YES** |
| #183 autopilot tasks scope | P0/P1 | Open; conflicts with #182 | **YES** (resolved in local RC) |
| #185 JLWM prod seed gate | P1 | Open | **YES** |
| #184 evidence docs | P3 | Open | Optional |
| #139 GUC containment | P0 | Open on recovery base | **YES for DB safety** — separate integration track |
| #165 duplicate to main | — | CONFLICTING | **NO** — close |
| Unrelated features on develop tip only | FEATURE | — | Defer |

## Already deployed?

Unknown (prod SHA UNVERIFIED). Relative to **main tip**: #164 and cohesion PRs **not** on main → not in documented production-track tree.
