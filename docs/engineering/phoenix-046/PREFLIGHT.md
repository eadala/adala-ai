# ADALA-046 Preflight

| Check | Result | Class |
|-------|--------|-------|
| Destination PRIVATE | YES — `adalahai/adala-ai-private-recovery-2026`, `private=true`, `visibility=private` | VERIFIED (cursor-github MCP as `adalahai`) |
| Push permission (MCP metadata) | `permissions.push=true`, `admin=true` | VERIFIED metadata |
| Shell/git write identity can access dest | **NO** — `git ls-remote` / `gh api` → Repository not found (404). Managed `x-access-token` scoped to workspace `eadala/adala-ai`; `gh` user `cursor` integration cannot see private recovery repo | VERIFIED |
| Source commit/tree | `8685f64a…` / `ea8b8e85…` | VERIFIED |
| Contaminated blob in 031 | ABSENT | VERIFIED |
| Destination empty / no `backup/phase-031-clean` | Empty repo (no commits) | VERIFIED (MCP) |
| Actions workflows | 0 | VERIFIED (MCP) |
| Webhooks / Coolify | Not inspectable with shell identity; no MCP hooks tool | UNKNOWN |
| Credential incident | Exposed `ghs_` residual risk documented; **not used**. Shell auth is separate Cursor integration token. Remediation still owner-side for captured forensic token | DOCUMENTED |

## Gate decision

**Mandatory network-write identity fails.** Cannot execute `git push` to destination with available trusted credentials.

**DEPLOYMENT_ISOLATION:** Actions empty VERIFIED; webhooks/Coolify UNKNOWN → would also block if write were available, unless hooks cleared via authorized API as `adalahai`.

**STOP — no push.**
