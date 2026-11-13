# ARC Approval Security

## Roles

platform_owner · release_manager · independent_reviewer · production_operator · read_only_auditor · ai_agent

## Separation of duties

| Step | Allowed roles |
|------|---------------|
| Request approval | release_manager, platform_owner, production_operator |
| Grant approval | **independent_reviewer only** (Phase 1) |
| Execute deploy | production_operator / platform_owner — **still 403 disabled** |
| Read audit | auditor, owner, release_manager |

## Rejected

- Self-approval (actor == request author)  
- AI agent approvals  
- Expired requests (>7 days or status expired)  
- SHA / image digest mismatch vs release  

## Binding

Approval request stores: commitSha, imageDigest, targetEnvironmentId, migrationPlan, deploymentWindow, policyVersion.

Material change → new request required (invalidate prior).
