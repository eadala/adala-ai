#!/usr/bin/env bash
# Push a single verified commit to the private recovery repo.
# Requires: OWNER authorization for this exact scope + trusted auth as destination owner.
# Never uses --force / --mirror / --all. Never pushes to public origin.
set -euo pipefail
COMMIT="${1:-}"
DEST_BRANCH="${2:-}"
DEST_REPO="${BACKUP_REMOTE_REPO:-adalahai/adala-ai-private-recovery-2026}"
if [[ -z "$COMMIT" || -z "$DEST_BRANCH" ]]; then
  echo "FAIL: usage: $0 <commit-sha> <dest-branch>"
  exit 2
fi
if [[ "${ALLOW_REMOTE_BACKUP:-0}" != "1" ]]; then
  echo "FAIL: ALLOW_REMOTE_BACKUP=1 required"
  exit 1
fi
if [[ "$DEST_BRANCH" == main || "$DEST_BRANCH" == develop || "$DEST_BRANCH" == cursor/* ]]; then
  echo "FAIL: forbidden destination branch pattern: $DEST_BRANCH"
  exit 1
fi

# Prefer explicit adalahai token; do not rely on workspace insteadOf rewrite.
if [[ -z "${GH_TOKEN:-}" ]]; then
  export GH_TOKEN
  GH_TOKEN="$(gh auth token)"
fi

python3 - "$COMMIT" "$DEST_BRANCH" "$DEST_REPO" <<'PY'
import json, os, subprocess, sys, urllib.request

commit, branch, repo = sys.argv[1:]
token = os.environ["GH_TOKEN"]

def api(path):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "adala-remote-backup",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

meta = api(f"/repos/{repo}")
if not meta.get("private"):
    raise SystemExit("FAIL: destination is not private (public destinations forbidden)")
if str(meta.get("visibility", "")).lower() == "public":
    raise SystemExit("FAIL: destination visibility is public")
hooks = api(f"/repos/{repo}/hooks")
workflows = api(f"/repos/{repo}/actions/workflows")
if hooks:
    raise SystemExit("FAIL: destination has webhooks")
if workflows.get("total_count", 0) != 0:
    raise SystemExit("FAIL: destination has Actions workflows")

# Protect immutable Phase 031 recovery branch
if branch.strip("/") == "backup/phase-031-clean":
    raise SystemExit("FAIL: refusing to overwrite immutable Phase 031 backup ref")

# Never treat the public application origin as a backup destination
if repo.lower() in {"eadala/adala-ai"}:
    raise SystemExit("FAIL: refusing public application origin as backup destination")

url = f"https://x-access-token:{token}@github.com/{repo}.git"
# Verify commit exists locally
subprocess.check_call(["git", "rev-parse", f"{commit}^{{commit}}"])
# Contaminated blob must not be reachable from the pushed tip
contam = "3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925"
objs = subprocess.check_output(["git", "rev-list", "--objects", commit], text=True)
if contam in objs:
    raise SystemExit("FAIL: contaminated blob reachable from commit — push blocked")

r = subprocess.run(
    ["git", "push", url, f"{commit}:refs/heads/{branch}"],
    capture_output=True,
    text=True,
)
print(((r.stdout or "") + (r.stderr or "")).replace(token, "REDACTED"))
if r.returncode != 0:
    raise SystemExit(r.returncode)
print(f"REMOTE_PUSH_OK {repo} {branch} {commit}")
PY
