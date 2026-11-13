# ARC Threat Model (Phase 1)

## Assets

- Release approval decisions  
- Deployment execution capability (must stay disabled)  
- Provider credentials (Coolify/GitHub tokens)  
- Audit trail integrity  
- Operator role bindings  

## Adversaries

| Actor | Goal |
|-------|------|
| External attacker | Trigger deploy / steal tokens |
| Malicious insider | Self-approve and ship |
| Compromised AI agent | Count as independent reviewer |
| Confused deputy | Browser XSS reads server tokens |

## Controls (Phase 1)

| Threat | Mitigation |
|--------|------------|
| Unauthorized deploy | Kill-switch + 403 on `/deployments/execute` |
| Self-approval | `validateApprovalAttempt` rejects author==approver |
| AI as reviewer | `ai_agent` role rejected for approve |
| Token in browser | Tokens only in arc-server env; never returned in JSON |
| Fake production SHA | Coolify mock returns UNVERIFIED; UI labels source/time |
| Fail-open gates | Mandatory UNVERIFIED/FAIL/BLOCKED → `blocksDeployment` |
| Audit wipe | Append-only API; no delete; Phase 1 memory (limitation documented) |
| Provider outage | Typed UNAVAILABLE/UNVERIFIED; last observation timestamps retained in fixtures |

## Out of scope Phase 1

- Live Coolify mutating APIs  
- Hardware-backed audit WORM storage  
- Full OIDC/Clerk for ARC operators (header token local only)
