---
name: Adala Multi-Branch System
description: office_branches table, plan-gated branch creation, branch_id on core tables, API routes, frontend page
---

## Architecture
- Table: `office_branches` (id UUID, office_id TEXT, name, code, location, description, phone, email, manager_name, status, created_at)
- `branch_id UUID` added (ALTER TABLE IF NOT EXISTS) to: cases, clients, client_invoices, tasks
- Indexes: idx_office_branches_office, idx_cases_branch, idx_clients_branch

## API Routes (/api/branches/*)
- GET /branches — list with cases_count/clients_count/tasks_count + plan/branchLimit
- GET /branches/:id — single branch
- GET /branches/:id/stats — detailed stats (cases/clients/invoices/tasks/AI)
- POST /branches — create (enforces plan limit)
- PATCH /branches/:id — update
- DELETE /branches/:id — soft deactivate (blocks if has active cases)
- POST /branches/transfer-case — move case between branches
- POST /branches/assign-client — assign client to branch
- GET /branches/dashboard — KPI summary + topByRevenue + recentActivity
- GET /admin/branches — super admin all branches across tenants

## Plan Limits (inline in branches.ts, no frontend import)
- free/starter/basic: 0 branches
- professional: 3 branches
- growth: 10 branches
- enterprise/ultimate/white_label: unlimited

## Critical: Import path
- db import: `@workspace/db` (NOT ../../core/db)
- Frontend page: `/branches` route, ProtectedRoute
- Nav: layout.tsx Admin section, icon: GitBranch

**Why:** Plan limit check uses inline BRANCH_LIMITS map — do NOT import from frontend plan-features.ts (causes esbuild resolve error since it's a frontend file).
