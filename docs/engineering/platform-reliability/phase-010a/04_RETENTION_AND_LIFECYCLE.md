# Retention and Lifecycle (Draft)

**Status:** POLICY DRAFT — legal approval required for anything touching real customer data. First drills use synthetic data only.

## Backup classes

| Class | Contents | Proposed non-prod retention |
|-------|----------|------------------------------|
| Full logical DB dump | `pg_dump -Fc` | 30 days OR last 30 successful objects |
| Tenant snapshot (if used) | Encrypted JSON snapshots | 14 days |
| Drill evidence metadata | Checksums, durations, outcomes | 90 days |
| Customer legal documents in object storage | **Not** part of DB dump | Separate document retention — **do not auto-delete** via backup lifecycle |

## Lifecycle rules (proposed)

1. Expire `backups/full/` objects older than 30 days
2. Abort incomplete multipart uploads after 7 days
3. Do **not** apply lifecycle deletion to application document prefixes (`private/`, case files, etc.)
4. No automated deletion of legal-hold or customer records in this phase

## Orphans

- Failed uploads leaving `.partial` locally: cleaned by backup job
- Remote objects without checksum sidecar: quarantine prefix `backups/quarantine/` for manual review (010-B procedure)

## Cost / growth control

- Measure actual dump size in first 010-B drill before locking retention
- Cap concurrent restore scratch disks; destroy disposable restore DBs after each drill
