# Security Non-Regression

## Baseline preserved

Tenant security commit `d2f7e3695a3a1d37b9e091e4525deb18fa087c07` is an ancestor of the reliability branch base.

## Controls not weakened

Membership validation, office authz, payment/AI credit/agent isolation, WhatsApp authz, RLS, GUC containment, cron scope, ARC restrictions — untouched by reliability modules.

## CI

Existing `test:tenant-isolation-gate` retained; no duplicate CI pipeline added. New script: `test:platform-reliability` only.

## Restore safety

Disposable DB name prefix enforcement; production-like names rejected; restore allow-flag required.
