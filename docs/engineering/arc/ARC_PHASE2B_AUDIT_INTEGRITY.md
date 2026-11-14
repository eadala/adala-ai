# ARC Phase 2B Audit Integrity

## Design

- Dual persistence: append-only JSONL + SQLite hash-chained store (`DurableAuditStore`).
- Isolated development DB only — **no production PostgreSQL modifications**.
- Event fields: id, type, actor, actorType, action, resource, environment, correlation id, timestamp, outcome, release id, sanitized metadata, sequence, prevHash, eventHash.
- Triggers reject UPDATE/DELETE at SQL layer.
- Deterministic canonical serialization + SHA-256 chaining.
- Secret redaction before persistence.

## Fail-closed

Security-critical successful mutations set `critical: true` and throw if durable append fails.

## Limitations (explicit)

- **Not WORM.** Database administrators can offline-tamper; chain verification detects but does not prevent OS-level rewrite.
- Retention/export tooling is local verify + list APIs — external immutable object storage not claimed.

## Tests

Restart persistence, concurrent writes, update rejection, redaction, integrity verify — PASS.

## Status

**PASS** (local durable integrity) · WORM claim: **NOT claimed**
