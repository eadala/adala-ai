# F-PRELIVE-001 Security Tests

## Command

```bash
cd artifacts/arc-server && pnpm test && pnpm typecheck
bash -n scripts/arc-live-validation.sh
./scripts/arc-live-validation.sh   # unauthorized dry-run
pnpm exec tsx scripts/validate-base-url.ts 'http://evil.example:8787'  # expect deny
pnpm exec tsx scripts/validate-base-url.ts 'http://127.0.0.1:8787'     # expect ok
```

## Results (this remediation)

| Suite | Result |
|---|---|
| Full ARC tests | **129/129 PASS** (104 prior + 25 F-PRELIVE-001) |
| Typecheck | PASS |
| Script syntax | PASS |
| Dry-run unauthorized | PASS (no network) |
| CLI deny public URL | exit ≠ 0 |
| CLI accept loopback | exit 0 |

## Mapped negatives (1–18)

Covered in `src/tests/prelive-f001-base-url.test.ts` including DNS rebinding mock, proxy env, production target, AI allowlist non-authority, authorized script refusal of evil BASE_URL.

Isolated mocks only — no real external service contact for denial cases.
