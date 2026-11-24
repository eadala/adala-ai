# Owner-Executable Credential Remediation (Sanitized)

**Incident:** Public repository `eadala/adala-ai` reachable history contains contaminated blob `3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925` (forensic `baseline-capture.txt` ancestral content). Token class: GitHub App installation token (`ghs_` prefix).

**Do not print or reuse the token.**

## Immediate actions (owner)

1. **Assume compromise** until proven revoked/expired.
2. In GitHub → Settings → Applications / Installation → revoke or rotate the installation that issued the exposed `ghs_` token (or uninstall/reinstall the app to invalidate tokens).
3. Rotate any related secrets that may have been reachable in the same capture era (Clerk, Stripe, DB URLs, storage keys) if they appeared in forensic evidence.
4. Review GitHub audit log for unexpected activity after exposure timestamp.
5. Confirm CI/CD deploy tokens were not reused from that capture.
6. Prefer all future milestone transfers only to private `adalahai/adala-ai-private-recovery-2026`.

## Public history cleanup (requires explicit approval — NOT performed)

- Affected public ref: `cursor/phase-049-engineering-continuity-da81` (and any descendant tips sharing ancestry).
- Coordinate with collaborators; backup private clean-tree artifacts first.
- Use filter-repo/BFG only after written approval; force-push is otherwise forbidden.
- After rewrite: verify contaminated OID absent; notify forks/PRs; invalidate CDN/cache as needed.

## Engineering controls already in place

- Tip tree redacted.
- Clean-tree orphan bundles exclude contaminated ancestry objects.
- `remote-backup-push.sh` refuses public destinations and Phase 031 overwrite.
- Phoenix V / Ultimate work not pushed to public origin.
