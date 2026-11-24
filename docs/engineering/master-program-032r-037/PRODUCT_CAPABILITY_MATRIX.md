# Product Capability Matrix (tip vs documented LOCAL-ONLY)

Legend: ON_TIP = present in current tree; DOC_ONLY = claimed in tracker/docs, objects missing; UNKNOWN = not verified.

| Capability area | Tip status | Notes |
|-----------------|------------|-------|
| Fee agreements / appointments / lawyer reply (031) | ON_TIP | Under 031 branch + tip ancestry |
| Fake refund / credit-note path (031) | ON_TIP | Local fake transport |
| Period-close | DESIGN_ONLY | No execution authorized |
| Migrations 062–075 assurance/RAG | DOC_ONLY | Files absent |
| Secure legal RAG (029) | DOC_ONLY | Paths absent; tip `4d76a954`/`8857b406` MISSING |
| RAG semantic readiness (030) | DOC_ONLY | Commit absent |
| Client portal correspondence (025) | PARTIAL/UNKNOWN | Portal exists; DEF-025 lineage absent |
| Financial safety 023–024 | PARTIAL/UNKNOWN | Financial module present; exact assurance commits absent |
| Privileged identity 018–021 | PARTIAL/UNKNOWN | Modules present; live Clerk blocked historically |
| Wave A–C control plane | PARTIAL/UNKNOWN | Need recovered trees for exact deltas |

Do **not** rebuild entire phases for missing history without separate reconstruction approval.
