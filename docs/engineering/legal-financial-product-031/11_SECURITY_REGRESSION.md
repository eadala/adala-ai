# 11 — Security Regression

- Test auth gated by ADALA_HTTP_SECURITY_TEST only
- Portal public reads use single-connection tenant GUC (FORCE RLS)
- Live Stripe/Clerk keys deleted in harness
- Refund live path forbidden
- RLS refund_requests cross-tenant isolation check PASS
