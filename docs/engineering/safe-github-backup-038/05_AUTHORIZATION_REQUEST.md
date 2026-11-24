# Authorization Request — ADALA-038

**HUMAN_APPROVAL_REQUIRED:** YES

Approve only after:

1. Confirm destination: **private** backup repository URL (or accept public archival in writing).
2. Confirm Coolify does **not** auto-deploy on `backup/**` / custom `refs/backup/*` / tags.
3. Confirm or remediate secret findings in `02_SECRET_AND_DATA_REVIEW.md`.
4. Choose transfer method: Git ref push to private remote and/or encrypted bundle copy.
5. Explicit written approval to execute remote synchronization.

Until then: **no push, fetch, merge, or deploy.**
