# ARC Pre-Live Security Findings

**Directive:** ARC-SEC-PRELIVE-002  
**CRITICAL:** 0 · **HIGH (blocking):** 0 · **MEDIUM:** 1 · **LOW:** 3 · **INFORMATIONAL:** 3

---

### F-PRELIVE-001 — CLOSED (ARC-SEC-FIX-003)

- **Severity:** MEDIUM (historical)  
- **Component:** `scripts/arc-live-validation.sh` + `lib/validationBaseUrl.ts`  
- **Remediation:** Loopback-default allowlist, DNS binding checks, proxy deny, curl `--max-time`/`--max-redirs 0`, CLI preflight  
- **Evidence:** `ARC_PRELIVE_F001_CLOSURE_EVIDENCE.md`; tests **129/129**  
- **Acceptance:** Unauthorized destinations denied; local fixtures OK; deploy still disabled

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
