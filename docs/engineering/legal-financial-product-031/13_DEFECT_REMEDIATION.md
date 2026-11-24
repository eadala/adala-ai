# 13 — Defect Remediation

| Defect | Fix |
|--------|-----|
| Portal 404 case under FORCE RLS (pooled GUC) | Transactional pool client + set_config |
| expenses.office_id missing broke reconcile | 061 ADD COLUMN + resilient query |
| 037 rollback left no credit_notes | 061 CREATE IF NOT EXISTS safety net |
| client_portal_tokens lacked office_id | 061 ADD COLUMN |
| Live fincore refund always open | LIVE_REFUND_FORBIDDEN gate |
