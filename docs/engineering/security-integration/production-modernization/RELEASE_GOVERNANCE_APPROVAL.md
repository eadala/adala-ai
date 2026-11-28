# Release Governance Approval

## #164 incident lesson

- Auto-merge enabled by admin; squash merged with **zero reviews**
- Status checks enforcement historically `non_admins`
- CODEOWNERS sole `@eadala` ≡ author
- Ruleset `adalah-ai` enforcement **disabled**

## Required before next production-bound merge

1. Disable repo Allow auto-merge (or never enable per-PR)  
2. Require ≥1 approving review **including administrators** (no bypass)  
3. Second independent CODEOWNER / reviewer  
4. Active ruleset on `main` (and `develop` if used for promote)  
5. Human checklist: SHA pins, CI green, Auto-merge OFF, Coolify Auto Deploy paused or intentional  

## This agent

Will **not** approve, merge, enable Auto-merge, or bypass protection.
