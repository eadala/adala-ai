---
name: Adala AI Credits System
description: AI credits per office — deduction, topup, auto-renew, super-admin panel, sidebar widget
---

## Tables
- `office_ai_credits`: office_id (UNIQUE), office_name, balance, monthly_allowance, auto_renew, renew_day, last_renewed_at
- `ai_credit_transactions`: office_id, amount (negative=usage), type (topup/renewal/usage/adjustment), description, model

## Model costs
- gemini = 1 credit, claude = 3, openai = 3, fallback = 0 (defined in MODEL_CREDIT_COST)

## Backend routes (all in aiCredits.ts)
- GET  /api/admin/ai-credits           — list all offices + used_this_month (admin only)
- GET  /api/admin/ai-credits/:id/transactions — tx history (admin only)
- POST /api/admin/ai-credits/topup     — add credits manually
- POST /api/admin/ai-credits/settings  — update monthly_allowance / auto_renew / renew_day
- POST /api/admin/ai-credits/renew     — force renewal (one office or all)
- POST /api/admin/ai-credits/add-office — register new office
- POST /api/ai-credits/deduct          — internal deduction (called from callAI)
- GET  /api/office/ai-credits          — current office balance (non-admin)

## callAI integration
- deductCredits() is NON-BLOCKING (fire-and-forget after reply returned)
- doesn't fail AI call if balance is 0 — just skips deduction
- Tables auto-created by ensureCreditTables() on module load

## Frontend
- super-admin.tsx: AiCreditsTab — topup/settings/transactions/renew dialogs per office
- ai-hub.tsx: credits widget in sidebar bottom — shows balance, progress bar, auto-refreshes after each chat message

**Why:** SaaS monetization requires per-office usage tracking; non-blocking deduction ensures AI performance is never impacted by credit logic failures.
