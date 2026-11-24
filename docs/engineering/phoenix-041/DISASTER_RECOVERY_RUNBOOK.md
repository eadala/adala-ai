# Disaster Recovery Runbook (post-transfer)

1. From a **new** machine/VM: `git clone --branch backup/phase-031-8685f64a <private-url> /tmp/adala-dr`
2. Assert `git rev-parse HEAD` == `8685f64a…` and tree `ea8b8e85…`
3. `git cat-file -t 3f1a3e36…` must fail (contaminated blob absent)
4. Confirm migrations include `061_legal_financial_product_completion.sql`
5. Record checksum of remote tip; write evidence

**OFF_ENVIRONMENT_RESTORE:** NOT_PERFORMED (transfer not done)
