---
name: Adala Validation Cycles + Enhanced Pentest
description: Financial cycle test, legal cycle test, K6 script, and enhanced 22-check pentest
---

## Financial Cycle Test
- `POST /api/engineering/financial-cycle-test` (engineeringOnly)
- 7 steps: INSERT client → INSERT client_invoices → UPDATE status='paid' → INSERT revenues → COUNT journal_entries → SUM revenues/expenses → DELETE all
- Uses TEST_OFFICE = "ddddeeee-0000-0000-0000-000000000099" (demo office)
- Cleanup runs both on success and catastrophic failure
- Saved to engineering_scans as scan_type='financial_cycle'

## Legal Cycle Test
- `POST /api/engineering/legal-cycle-test` (engineeringOnly)
- 8 steps: INSERT cases (open) → INSERT case_sessions → INSERT tasks → UPDATE active → UPDATE tasks done → UPDATE closed → COUNT audit_logs → DELETE all
- case_sessions INSERT wrapped in .catch() — table may not have all columns
- Saved as scan_type='legal_cycle'

## K6 Script (GET /api/engineering/k6-script)
- Returns JS file as `text/plain` attachment (k6-adala.js)
- 7 scenario weights: status 30%, cases 25%, clients 15%, invoices 12%, dashboard 8%, AI 6%, billing 4%
- 3 stages: 100 (2min) → 500 (2min) → 1000 (2min) concurrent users
- Thresholds: http_req_duration p(95)<2000, error_rate<0.01

## Enhanced Pentest (22 checks)
New multi-tenant checks added on top of existing OWASP:
- MT-01a: Cross-office header injection (x-office-id, x-tenant-id, x-workspace-id, x-forwarded-office)
- MT-01b: URL param tenant bypass (office_id, tenantId)
- MT-02: IDOR on cases/clients/invoices
- AUTH-01: JWT manipulation (4 vectors including alg:none)
- AUTH-02: Role header privilege escalation
- INJECT-02: Prompt injection (3 jailbreak payloads)
- XSS-01: Reflected XSS
- RL-02: Rate limit bypass via X-Forwarded-For rotation
- FILE-01: HTML file upload abuse
- BACKUP-01: Backup/export unauthorized access

**Why:** These are the attack vectors specific to a multi-tenant Arabic legal SaaS; generic OWASP scanners miss tenant escape + prompt injection.

## Frontend
- New "التحقق" tab (CircleCheck icon) between database and tasks in TabsList
- Cards: Financial Cycle, Legal Cycle, K6 download
- TEST_OFFICE const defined once at module level in engineering.ts — reuse for future validation tests
