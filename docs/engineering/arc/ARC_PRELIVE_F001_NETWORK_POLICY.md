# F-PRELIVE-001 Network Policy

## Policies

### `loopback` (default)

| Rule | Value |
|---|---|
| Scheme | `http` only |
| Host | `127.0.0.1`, `localhost`, `::1` / `[::1]` |
| Ports | 8787, 5177, 3000, 5000, 8080 (or `ARC_BASE_URL_ALLOW_ANY_LOOPBACK_PORT=true`) |
| Resolved IPs | Must all be loopback |
| Production hosts | Always denied |
| Metadata | Always denied |

### `staging_allowlist` (future isolated staging — not activated)

| Rule | Value |
|---|---|
| Env | `ARC_BASE_URL_POLICY=staging_allowlist` |
| Allowlist | `ARC_BASE_URL_ALLOWLIST=host1,host2` **required** (empty → DENY) |
| Scheme | `https` only |
| Resolved private IPs | Denied unless IP explicitly listed |
| Who may expand allowlist | Operator-administered env only — not AI, not end users, no API |

### Production observation

**Not implemented / not activated.** Production domains remain blocklisted.

## Redirects

Script: `curl --max-redirs 0` (no follow). Unexpected redirect → connection failure / deny.

## Proxies

Proxy env → DENY unless explicitly reviewed `ARC_ALLOW_HTTP_PROXY=true`.
