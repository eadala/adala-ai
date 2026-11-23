---
name: Adala Org Structure
description: Organization units system — DB table, API routes, frontend page, nav registration
---

# Org Structure System

## DB Table
`organization_units` — created via `ensureTables()` in `orgStructure.ts` (no drizzle schema needed)
Columns: id, firm_id, name, type, parent_id, manager_id, manager_name, status, description, created_at, updated_at

## Unit Types
BRANCH, DEPARTMENT, SECTION, TEAM, LEGAL_DEPARTMENT, CONTRACTS_DEPARTMENT, COMPLIANCE_DEPARTMENT, GOVERNANCE_DEPARTMENT

## API Routes (orgStructure.ts → registered in index.ts)
- GET /api/org-units → all units
- GET /api/org-units/:id → single
- GET /api/org-units/:id/stats → cases/clients/contracts/revenue per unit
- GET /api/org-units-dashboard → aggregate stats + topUnits
- POST /api/org-units → create
- PATCH /api/org-units/:id → update (name/type/parent/manager/description/status)
- PATCH /api/org-units/:id/move → change parent_id only
- PATCH /api/org-units/:id/status → toggle active/inactive
- DELETE /api/org-units/:id → fails if has children
- GET /api/org-units-users → users list for manager picker

## Frontend Page (/org-structure)
4 tabs: Шajara (tree), List, Stats, Scope (visibility)
- Tree tab: recursive TreeNode component with expand/collapse, indent by level, DropdownMenu actions
- List tab: searchable, filterable table
- Stats tab: type distribution + top-units-by-cases + new roles info cards
- Scope tab: role→scope table + scope definitions

## Nav
layout.tsx admin group: Network icon, labelKey "nav.items.org_structure"
i18n ar: "الهيكل التنظيمي", en: "Org Structure"

## Known Gotcha
Mixing `??` with `||` without parens causes Babel parse error. Always write:
`(a ?? b) || null`  NOT  `a ?? b || null`

## New Roles (defined in page constants, not yet in rbac.ts)
legal_manager, contracts_manager, compliance_officer, governance_officer

## Visibility Scopes
ALL, ORGANIZATION, UNIT, TEAM, ASSIGNED_ONLY, OWN_ONLY
