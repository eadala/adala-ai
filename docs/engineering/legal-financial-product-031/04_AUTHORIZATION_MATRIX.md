# 04 — Authorization Matrix

| Action | Rule |
|--------|------|
| Create/amend/activate | requireAuthWithTenant + financial roles |
| Forged officeId in body | 403 TENANT_FORGERY |
| Cross-office get | 404 |
| Portal appointments | token + client_visible only |
| Lawyer reply | requireAuth + reply comm perm |
| Refund authorize | owner/manager/accountant |
| Live fincore refund | 403 LIVE_REFUND_FORBIDDEN |
| RLS | FORCE on fee_* and refund_requests |
