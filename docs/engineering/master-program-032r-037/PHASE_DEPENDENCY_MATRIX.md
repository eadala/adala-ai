# Phase Dependency Matrix

| Phase | Depends on | Hard blockers if unmet |
|-------|------------|------------------------|
| 032R | Local object DB + forensic evidence | Missing exact history without auth |
| 033 | 032R trustworthy baseline **approved** | No integration without baseline |
| 034 | 033 INTEGRATION_CLOSED_LOCAL | UI on unverified code forbidden as “complete” |
| 035 | 033 + 034 gates | AI/RAG without recovered or rebuilt stack |
| 036 | 033–035 local close | Adversarial tests need integrated tip |
| 037 | 036 SECURITY_RELIABILITY_CLOSED_LOCAL | No RC without assurance |

**032R → 033:** BLOCKED until recovery decision resolves to verified history **or** human-approved reconstructed baseline.
