---
name: Super-admin refactor constants injection
description: Lessons from extracting 31 tab files from the 7842-line super-admin.tsx monolith
---

## The Rule
When extracting a function from a monolith into its own file, any module-level
constant defined BEFORE that function in the original file must be explicitly
copied into the new tab file — it will NOT be imported automatically.

## Correct Python detection pattern
```python
# WRONG — 'GOLD' also appears in usage lines like stroke={GOLD}
if 'GOLD' not in content:

# CORRECT — only matches const definition
if 'const GOLD' not in content:
```

## Constants extracted per tab file
| Tab | Constants Added Locally |
|-----|------------------------|
| PlansTab | PLAN_COLORS, EMPTY_PLAN_FORM |
| HostingCenterTab | HOST_BASE (IIFE fetch helper) |
| GlobalControlTab | GOLD, PLAN_COLORS_GC, RISK_COLOR, RISK_LABEL |
| GhostCenterTab | GHOST_QUICK_LINKS, GHOST_CASE_STATUS, GHOST_INV_COLOR/LABEL |
| AgentRuntimeTab | SA_BASE, saFetch, SEV_COLOR, SEV_AR |
| PlatformCommandCenterTab | SA_BASE, saFetch |
| PlatformBillingTab | PLAN_COLORS_SA |
| PlatformCasesTab | CASE_STATUS |
| PlatformContractsTab | CONTRACT_STATUS |
| PlatformFinanceTab | CHART_COLORS |
| PlatformWebsiteTab | WEBSITE_SECTIONS, FIELD_LABELS |
| EngineeringHeroTab | BASE |

## Regex pitfall (saFetch extraction)
Regex `[^}]+` stops at first `}` inside template literals like `` `Bearer ${token}` ``.
This left orphaned `` ` } }).then(r => r.json()); `` causing TS1160 Unterminated template literal.
Fix: always replace entire function body using exact string match, not regex.

**Why:** These constants were originally defined at module scope between functions
in the monolith. After extraction each function became its own module — constants
must travel WITH the function or come from a shared import.
