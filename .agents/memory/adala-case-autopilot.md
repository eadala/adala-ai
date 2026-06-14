---
name: Adala Case Autopilot
description: AI-driven case health scoring + autonomous task generation engine
---

## Architecture

- **Engine**: `artifacts/api-server/src/agents/caseAutopilot.ts`
  - `runCaseAutopilot(caseId, tenantId, createTasks)` — main entry
  - `ensureAutopilotTable()` — creates `case_autopilot_reports` (PK: case_id)
  - Health score 0-100 from 6 factors: client(20) + description(15) + docs(20) + hearing(20) + contract(15) + assigned(10)
  - Grades: A≥90 / B≥75 / C≥60 / D≥40 / F<40
  - Calls `callAI()` from `aiChat.ts` for Gemini summary + outcome prediction
  - Auto-creates tasks in `tasks` table with `created_by='autopilot'` tag

- **EventBus Listener**: `artifacts/api-server/src/core/listeners/autopilotListener.ts`
  - `CASE_CREATED` → runs autopilot with `createTasks=true` after 3s delay
  - `CASE_UPDATED` → refreshes score only (`createTasks=false`) after 2s delay
  - Registered in `src/core/listeners/index.ts`

- **API Routes** (added to `cases.ts`):
  - `GET /api/cases/:id/health` — returns cached report or fresh analysis; `?force=1` bypasses cache
  - `POST /api/cases/:id/autopilot` — manual trigger; creates tasks + audit log

- **Frontend**: `artifacts/adala/src/components/case-autopilot-card.tsx`
  - ScoreRing SVG (circular progress)
  - Grade badge, score bar, prediction label, AI summary
  - Expandable: risks / missing data / tasks created count
  - Refresh button → `POST /cases/:id/autopilot`
  - Inserted in case-detail.tsx sidebar below description card

## Key constraints

- `tasks` table uses `case_title` (TEXT) not `case_id` (UUID) for case linkage
- `callAI()` is exported from `src/routes/aiChat.ts` (not a separate utility file)
- `case_autopilot_reports` has UPSERT on `case_id` — safe to re-run
- Autopilot runs non-blocking (setTimeout) to not slow case creation response

**Why:** Transforms platform from passive record-keeping to active legal workflow engine — the highest-value piece missing from the "Legal OS" architecture proposal.
