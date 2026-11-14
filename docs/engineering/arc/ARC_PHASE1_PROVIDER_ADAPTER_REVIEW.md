# ARC Phase 1 Provider Adapter Review

## GitHub (`GithubReadAdapter`)

| Aspect | Status |
|--------|--------|
| Real API | Optional `fetch` to **hardcoded** `api.github.com` |
| Fixtures | Fallback UNVERIFIED |
| Auth | Optional `ARC_GITHUB_TOKEN` / `GITHUB_TOKEN` server-side only |
| Writes | None |
| Webhooks | None |
| SSRF | URL not user-controlled (fixed host) |
| Classification | **PARTIAL** — live when network/token allows; else fixture |

### Phase 2 minimum permissions (spec)

- `metadata:read`
- `contents:read`
- `pulls:read`
- `checks:read` / `actions:read`
- **No** `administration`, `workflows` write, `contents` write

## Coolify (`CoolifyAdapter`)

| Aspect | Status |
|--------|--------|
| Mock | Default — UNVERIFIED synthetic app |
| Staging live | Not tested |
| Production live | **Not attempted** |
| With env URL+token | Returns UNAVAILABLE **without HTTP** (safe) |
| executeDeploy | **false** |
| Classification | **VERIFIED_MOCK** |

Never treat mock watched branch `main` as VERIFIED_LIVE Auto Deploy state.
