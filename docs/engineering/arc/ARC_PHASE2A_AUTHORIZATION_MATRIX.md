# ARC Phase 2A Authorization Matrix

Permissions are server-side only (`lib/permissions.ts`).  
`deployment:execute` is **never** granted.

| Permission | Owner | Release Mgr | Ind. Reviewer | Prod Operator | Auditor | AI Agent |
|------------|:-----:|:-----------:|:-------------:|:-------------:|:-------:|:--------:|
| *:read (overview/releases/gates/…) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| audit:read | ✓ | ✓ | ✓ | | ✓ | |
| approval:request | ✓ | ✓ | | ✓ | | |
| approval:decide | | | ✓ | | | |
| deployment:request | ✓ | ✓ | | ✓ | | |
| deployment:execute | | | | | | |
| policy:modify | | | | | | |
| roles:modify | | | | | | |
| credentials:modify | | | | | | |

Empty cells = deny. Policy/roles/credentials routes exist only to return 403 for unauthorized/AI attempts.
