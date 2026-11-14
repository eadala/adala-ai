# ARC Phase 2B Monitoring Foundation

## Checks

Classifies observations into healthy / degraded / failed / unknown / stale with freshness thresholds.

## Reliability

- Timeouts → **unknown** (never healthy).
- Dedup/cooldown via `correlateIncident`.
- Read-only: no auto-repair, deploy, or DB modification.

## API

`GET /api/arc/monitoring/classified`

## Status

**PASS** (foundation) · Live invasive production probes: **NOT performed**
