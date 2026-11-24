# Access recovery & controlled CD activation — evidence

| Item | Result |
|------|--------|
| GH identity | `adalahai` |
| Collaborator | **write** on `eadala/adala-ai` |
| PR create | **OK** — #186 |
| PR CI | **PASS** — run 45340534586 ✅ All Gates Passed |
| Release Guardian (PR) | **PASS** — 45340534680 |
| Merge to develop | **BLOCKED** — `REVIEW_REQUIRED`; auto-merge enabled awaiting owner approval |
| Merge to main | **NOT ATTEMPTED** — Coolify still deploy-on-push on `main` |
| Kill switch var | `ADALA_CD_KILL_SWITCH=0` set |
| Credential remediation | TTL likely expired; App/installation rotation **UNVERIFIED** (cannot list installations with user token) |
| Private backups | Prior verified; Phase 031 `8685f64a` immutable |
| Coolify | No API; staging/prod CD not activated |
| Production healthz | healthy |
