---
name: Adala Enterprise SOC & Governance Center
description: 10-phase Enterprise Security & Governance layer — SOC, audit center, MFA, high-risk ops, compliance, DR, executive dashboard
---

## Backend Modules (all SA-guarded, all in src/modules/security/)
- `soc.ts` — Phase 1 (SOC dashboard) + Phase 3 (session revocation) + Phase 9 (threat detection)
  - Tables: security_sessions, security_alerts, blocked_ips, mfa_status_cache
  - Routes: /soc/dashboard, /soc/sessions, /soc/alerts, /soc/blocked-ips, /soc/threat-scan, /soc/export, /soc/login-*
- `auditCenter.ts` — Phase 2 (enterprise audit coverage)
  - Tables: audit_coverage_rules, audit_risk_scores + indexes on audit_logs
  - Routes: /audit-center/overview|logs|risk-analysis|coverage|export
- `mfaCenter.ts` — Phase 4 (MFA enforcement) + Phase 5 (high-risk ops)
  - Tables: high_risk_op_log, recovery_codes
  - Routes: /mfa/status|enforce-alert|recovery-codes, /high-risk-ops/catalog|logs|initiate|:id/confirm|:id/abort
- `complianceCenter.ts` — Phase 6 (PDPL/SOC2/ISO27001 compliance)
  - Tables: compliance_controls (pre-seeded 14 controls), data_requests, retention_policies (pre-seeded), legal_holds
  - Routes: /compliance/overview|controls|data-requests|retention-policies|legal-holds|report
- `drCenter.ts` — Phase 7 (disaster recovery)
  - Tables: dr_restore_points, dr_test_runs, dr_health_checks
  - Routes: /dr/health|restore-points|dashboard, /dr/restore-points/:id/test
- `executiveDashboard.ts` — Phase 8 + Phase 10 (executive scores + production validation)
  - Routes: /executive/dashboard, /executive/production-validation

## Frontend Pages (all AdminRoute-guarded)
- `/soc` → src/pages/platform/soc.tsx (6 tabs: dashboard/alerts/sessions/logins/blocked/threats)
- `/audit-center` → src/pages/platform/audit-center.tsx (4 tabs: overview/logs/risk/coverage)
- `/executive-dashboard` → src/pages/platform/executive-dashboard.tsx (6 tabs: overview/compliance/dr/mfa/high-risk/validation)

## Nav Items
Added to layout.tsx superadmin section: /soc, /audit-center, /executive-dashboard

## Key Design Decisions
- All tables use IIFE pattern (CREATE TABLE IF NOT EXISTS) for safe init
- All routes use `requireSuperAdmin` guard (never `requireAuth` alone)
- Compliance controls are pre-seeded with PDPL-8 + SOC2-4 + ISO27001-2 controls ON CONFLICT DO NOTHING
- Retention policies pre-seeded: audit_logs=7yr, documents/cases=10yr, messages=2yr
- Production validation endpoint checks: DB, all new security tables, Object Storage, env vars, multi-tenant, backup
- MFA status synced from Clerk API and cached in mfa_status_cache table
- Threat scan auto-creates security_alerts for detected threats (brute force, mass delete, cross-tenant, API abuse)
