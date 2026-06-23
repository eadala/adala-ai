---
name: Adala ai_workflows schema
description: ai_workflows and ai_workflow_runs tables must use TEXT (not uuid) for id columns to match production DB
---

# ai_workflows Column Types

**Rule:** `ai_workflows.id`, `ai_workflows.office_id`, `ai_workflow_runs.id`, `ai_workflow_runs.workflow_id`, `ai_workflow_runs.office_id` must all be **TEXT** in dev to match production.

**Why:** These tables were originally created with TEXT ids in production (raw SQL, not Drizzle schema). At some point dev DB drifted to UUID. When Replit's publish-time migration detected the diff, it generated `ALTER COLUMN id SET DATA TYPE uuid` without a USING clause — which PostgreSQL rejects (can't auto-cast text→uuid).

**How to apply:** If these columns ever drift to UUID in dev again, fix with:
```sql
ALTER TABLE ai_workflow_runs DROP CONSTRAINT IF EXISTS ai_workflow_runs_workflow_id_fkey;
ALTER TABLE ai_workflows ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE ai_workflows ALTER COLUMN office_id TYPE text USING office_id::text;
ALTER TABLE ai_workflow_runs ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE ai_workflow_runs ALTER COLUMN workflow_id TYPE text USING workflow_id::text;
ALTER TABLE ai_workflow_runs ALTER COLUMN office_id TYPE text USING office_id::text;
ALTER TABLE ai_workflow_runs ADD CONSTRAINT ai_workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES ai_workflows(id) ON DELETE CASCADE;
```
