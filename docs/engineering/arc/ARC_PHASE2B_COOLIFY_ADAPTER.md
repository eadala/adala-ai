# ARC Phase 2B Coolify Read-Only Adapter

## Interface

List/get applications, environment metadata, deployment history/status, image info.  
`executeDeploy` capability always `false`; `executeDeploy()` throws `coolify_mutation_forbidden`.

## Security

- Phase 2B blocks live production Coolify even if credentials are present (unless explicitly forced — still reported non-production).
- Administrator-controlled origin allowlist; no user-controlled URLs; SSRF host/metadata blocked.
- Versioned mock fixture modes: success, auth/permission failure, timeout, malformed, missing fields, version mismatch, rate limit.

## Operational correctness

Running commit / image digest remain **UNVERIFIED** unless independently attested. Branch/CI must not imply production identity.

## Status

**PASS** (mock fixture) · Production Coolify: **NOT CONNECTED** (required)
