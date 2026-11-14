# ARC Phase 2B Release Evidence Engine

## Release identity

Repository + commit SHA + tree SHA + artifact digest + target environment + policy version (`arc-policy-v2-phase2b`).

## Evidence categories

Source integrity, build integrity, test results, security validation, human review, migration compatibility, backup readiness, restore readiness, operational readiness.

## Outcomes

PASS | FAIL | BLOCKED | NOT_RUN | UNVERIFIED | EXPIRED

Missing/stale mandatory evidence → **BLOCKED**.

## TOCTOU

`approvalStillValid` invalidates on artifact digest change, source identity change, environment change, policy change, evidence expiry, reviewer revocation.

## Execution

Production deployment execution is **not implemented** and remains disabled.

## Status

**PASS** (engine + API `/evidence/:id`)
