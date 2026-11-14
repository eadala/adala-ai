# Reproducible Build Evidence

## Finding — unlocked install

- **Pre-fix:** root Dockerfile used `--no-frozen-lockfile`.
- **Post-fix:** `RUN pnpm install --frozen-lockfile` with pnpm `9.15.9` pinned.
- **Harness:** `DOCKER_FROZEN_LOCKFILE` PASS (static Dockerfile inspection).
- **Full image rebuild:** not required for local PASS; CI/image rebuild remains operational follow-up.
- **Mismatch behavior:** frozen install fails the build on lockfile drift (explicit).
