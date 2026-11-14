# ARC Pre-Live Security Findings

**Directive:** ARC-SEC-PRELIVE-002  
**CRITICAL:** 0 · **HIGH (blocking):** 0 · **MEDIUM:** 1 · **LOW:** 3 · **INFORMATIONAL:** 3

---

### F-PRELIVE-001

- **Severity:** MEDIUM  
- **Component:** `scripts/arc-live-validation.sh`  
- **Evidence:** Script uses unrestricted `ARC_BASE_URL` for curl when authorized  
- **Root cause:** Trusts operator env without loopback/allowlist  
- **Impact:** Mis-aimed live validation could contact unintended ARC host  
- **Reproduction:** Inspect script lines 15, 71–95 (authorized branch not executed)  
- **Remediation:** Allow only `127.0.0.1`/`localhost` or explicit allowlist; add `curl --max-time`  
- **Regression test:** Assert BASE_URL validation fails for non-local hosts  
- **Acceptance:** Live validation blocked unless URL allowlisted  

**Does not block PRELIVE_GO for human setup**; **must fix before LIVE validation authorization**.

---

### F-PRELIVE-002

- **Severity:** LOW · **Component:** validation script curl · Missing `--max-time` on GETs  
- **Remediation:** Add `--max-time 15 --max-redirs 0`

### F-PRELIVE-003

- **Severity:** LOW · **Component:** script `redact` · Incomplete secret patterns vs server `redactSecrets`  
- **Remediation:** Align with shared redaction patterns; never print PEM

### F-PRELIVE-004

- **Severity:** INFORMATIONAL · **Component:** OIDC live JWKS · Operator-supplied URL https-checked, not hostname-pinned beyond prod blocklist

### F-PRELIVE-005

- **Severity:** INFORMATIONAL · **Component:** MFA · `CONFIGURATION_REQUIRED` on IdP ACR emission

### F-PRELIVE-006

- **Severity:** INFORMATIONAL · **Component:** `fetchInstallationToken` · POST to fixed GitHub origin justified

### F-PRELIVE-007

- **Severity:** LOW · Same theme as F-PRELIVE-003 for boundary completeness

### Prior closed

- **F-001 / F-002:** Remain **CLOSED** (104/104 regression)

### Residual risk (not a defect claim)

- Audit hash-chain is not WORM; DB-admin offline rewrite possible though detectable.
