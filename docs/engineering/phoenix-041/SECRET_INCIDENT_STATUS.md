# Secret Incident Status

| Field | Status |
|-------|--------|
| SECRET_PROVIDER | GitHub |
| Type | `ghs_` installation/App-style (+ JWT-shaped companion) |
| Authenticated with exposed token | **NO** |
| Public on origin/main | NO (prior VERIFIED) |
| On contaminated local HEAD/checkpoint | YES |
| In Phase 031 export closure | NO |
| Validity | **Unknown** — do not assume expired |
| SECRET_REMEDIATION_STATUS | PENDING_OWNER_REVOCATION |
| Blocks Command B | NO (per directive) |
| Blocks Command E transfer | YES until remediation criteria / separate approval |

## Owner action (concise)

GitHub → revoke/rotate the App/installation credential that issued the captured `ghs_`. Review audit log. Do not paste secrets into chat.
