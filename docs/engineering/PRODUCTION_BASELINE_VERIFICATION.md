# Production Baseline Verification — Adalah AI

## Rule

**Never claim a Git commit is the production baseline without independent runtime evidence.**

Acceptable evidence (any one is insufficient alone — prefer two):

1. Coolify UI showing deployed commit / image digest for the **production** app serving `adalahai.com`.
2. Container / process inspect on the production host matching that digest/SHA.
3. Application-exposed build metadata endpoint (if present) matching the SHA.

Repository `origin/main` tip is **not** automatically production.

## Frozen candidate (code identity — not production)

| Field | Value | Role |
|-------|--------|------|
| Commit | `5441523302a1513f07b5dc08f028d848a0bad5b4` | Combined RC tip `#140` |
| Tree | `cd84a7f277c481dc5c96d707dde4e78d7f18e713` | Content identity |
| Ancestry | `#138 ⊂ #139 ⊂ #140` | Verified in prior release work |
| Production tag | **Forbidden until GO** | Do not tag as prod |

Verify identity:

```bash
git rev-parse 5441523302a1513f07b5dc08f028d848a0bad5b4^{tree}
# expect cd84a7f277c481dc5c96d707dde4e78d7f18e713
./scripts/release/verify-release.sh 5441523302a1513f07b5dc08f028d848a0bad5b4
```

## main vs candidate (refresh commands)

```bash
git fetch origin
git log -1 --format='%H %T %s' origin/main
git merge-base --is-ancestor origin/main 5441523302a1513f07b5dc08f028d848a0bad5b4 && echo 'main_is_ancestor=YES'
```

Record the **actual** SHAs returned; do not copy stale audit numbers blindly.

## Checklist before calling anything “in production”

- [ ] Production app identity confirmed (domain → Coolify app).
- [ ] Deployed SHA recorded from Coolify/host.
- [ ] SHA exists in GitHub (`git cat-file -t <sha>`).
- [ ] Tree SHA recorded.
- [ ] Migrations applied on prod DB listed separately (DB evidence, not Git alone).
- [ ] Coolify Auto Deploy state recorded (ON/OFF) with timestamp and operator name.
