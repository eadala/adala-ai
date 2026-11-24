#!/usr/bin/env bash
# CD preflight — fail-closed gates before any Coolify trigger.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
POLICY="$ROOT/release-guardian/cd-policy.json"
REF="${1:-HEAD}"

echo "=== cd-preflight ref=$REF ==="

python3 - "$POLICY" "$REF" <<'PY'
import json, os, subprocess, sys
policy=json.load(open(sys.argv[1],encoding="utf-8"))
ref=sys.argv[2]
blockers=[]

# Kill switch
if os.environ.get(policy["kill_switch_env"], "").strip() in {"1","true","TRUE","yes","ON"}:
    blockers.append("kill_switch_active")

# Credential incident
if policy.get("require_credential_incident_cleared"):
    cleared=os.environ.get(policy["credential_cleared_env"], "").strip().lower()
    if cleared not in {"1","true","yes"}:
        blockers.append("credential_incident_not_cleared")

# Contaminated history
contam=policy.get("contaminated_blob_oid")
if policy.get("require_clean_history") and contam:
    objs=subprocess.check_output(["git","rev-list","--objects",ref], text=True)
    if contam in objs:
        blockers.append("contaminated_history_reachable")

# DB backup verification gate (owner attestation via Actions variable)
if policy.get("pre_deploy", {}).get("require_backup_verified"):
    backup=os.environ.get("ADALA_DB_BACKUP_VERIFIED", "").strip().lower()
    if backup not in {"1", "true", "yes"}:
        blockers.append("db_backup_not_verified")

# Branch rules (when GITHUB_REF provided)
gh_ref=os.environ.get("GITHUB_REF_NAME") or os.environ.get("CD_BRANCH") or ""
deploy_branch=policy.get("deployment_branch","deploy/production")
if gh_ref:
    if gh_ref != deploy_branch and not gh_ref.startswith("refs/heads/"+deploy_branch):
        # Allow explicit simulation mode
        if os.environ.get("CD_SIMULATION") != "1":
            blockers.append(f"branch_not_deployable:{gh_ref}")
    for pfx in policy.get("forbidden_deploy_branch_prefixes",[]):
        if gh_ref.startswith(pfx.rstrip("/")):
            blockers.append(f"forbidden_branch_prefix:{gh_ref}")

# Destructive migration scan on pending SQL (tip tree)
if policy.get("pre_deploy",{}).get("reject_destructive_migration_keywords"):
    keys=policy["pre_deploy"]["reject_destructive_migration_keywords"]
    # Only flag NEW migrations vs base if provided; otherwise scan all tip migrations lightly for DROP TABLE without IF EXISTS guard is too broad.
    # Conservative: scan git diff migration files when CD_BASE set.
    base=os.environ.get("CD_BASE")
    files=[]
    if base:
        try:
            out=subprocess.check_output(["git","diff","--name-only",f"{base}...{ref}"], text=True)
            files=[f for f in out.splitlines() if f.startswith("artifacts/api-server/migrations/") and f.endswith(".sql")]
        except subprocess.CalledProcessError:
            blockers.append("migration_diff_unavailable")
    for f in files:
        try:
            text=subprocess.check_output(["git","show",f"{ref}:{f}"], text=True, errors="replace")
        except subprocess.CalledProcessError:
            continue
        upper=text.upper()
        for k in keys:
            if k in upper and "IF EXISTS" not in upper.split(k)[0][-40:]:
                # Heuristic — still block on DROP TABLE without nearby IF EXISTS in same statement line
                for line in text.splitlines():
                    lu=line.upper()
                    if k in lu and "IF EXISTS" not in lu and not lu.strip().startswith("--"):
                        blockers.append(f"destructive_migration:{f}:{k}")
                        break

out={"blockers":blockers,"ok":len(blockers)==0,"ref":ref}
print(json.dumps(out, indent=2))
sys.exit(0 if out["ok"] else 1)
PY
