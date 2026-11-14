# Process Recovery Tests

Disposable resources only (`adala-gate009*`, local node workers). Shared PostgreSQL service was not terminated.

| Scenario | Outcome |
|----------|---------|
| Terminate application (`docker kill`) | Container stopped |
| Restart application (`docker start`) | healthz/readyz 200 |
| Graceful stop (`docker stop`) | Exit 0 |
| Disposable worker SIGTERM | Process exits |
| Worker restart | Exit 0 with expected output |
| DB connection failure (bad DB name) | readyz 503; healthz stays 200 |
| DB recovery (valid disposable DB) | readyz 200 |
| False success check | Failed DB never reported ready |

Evidence: `evidence/container-lifecycle.json`
