---
name: Adala Bankruptcy Module
description: Architecture, security patterns, and schema for the bankruptcy (عدالة إفلاس) module
---

## Location
- Backend: `artifacts/api-server/src/modules/bankruptcy/bankruptcy.ts`
- Frontend: `artifacts/adala/src/pages/bankruptcy/index.tsx`
- Route: `/bankruptcy` (ProtectedRoute, no feature gate)
- Nav: layout.tsx → "cases" center → last item (Landmark icon)

## DB Tables (11 total, all with office_id)
`bankruptcy_cases`, `bk_creditors`, `bk_claims`, `bk_claim_documents`,
`bk_assets`, `bk_asset_valuations`, `bk_distribution_items`,
`bk_meetings`, `bk_distributions`, `bk_reports`, `bk_ai_analysis`

## Key Patterns
- `verifyCase(caseId, officeId)` must be called in ALL nested POST routes before insert
- UUID validation via `isUUID()` before any `::uuid` cast — prevents 500 errors
- Creditor ownership check: verify creditor's `case_id` matches before adding claims
- `UNIQUE(office_id, case_number)` — returns 409 on duplicate
- All status fields have CHECK constraints + server-side whitelist validation

## Status Lifecycles
- Case: active→suspended/claims_review/asset_management/distribution/closed/archived
- Claim: pending→submitted→under_review→approved/partially_approved/rejected/disputed/finalized
- Asset: identified→valuation→listed→sold→collected
- Distribution: draft→approved→executing→executed/cancelled

## Frontend Query Keys
All child resources use `[entity, caseId]` format:
`["bk-creditors", caseId]`, `["bk-claims", caseId]`, etc.
Dashboard must also be invalidated: `["bk-dashboard"]`

## Why: verifyCase() is critical
Without it, any authenticated user who knows another office's case UUID can inject
creditors/claims/assets into it. Always call before nested resource creation.

## New Routes Added in Audit
- PUT /bankruptcy/assets/:id
- PUT /bankruptcy/meetings/:id
- PUT /bankruptcy/distributions/:id
- POST /bankruptcy/assets/:id/valuations
- GET /bankruptcy/cases/:id/summary
