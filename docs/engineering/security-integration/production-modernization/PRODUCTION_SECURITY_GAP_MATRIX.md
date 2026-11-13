# Production Security Gap Matrix

Reachability assumes production ≈ `main` tip until proven otherwise (stated as ASSUMED).

| Gap | Severity | On main tip | On develop+#RC | Prod reachability |
|---|---|---|---|---|
| Inventing `default` office (AI credits, login, webhooks) | P0 | Present (pre-#164) | Fixed (#164+) | ASSUMED if prod≈main |
| Marketplace/portal IDOR (#166) | P0 | Present | Fixed in RC | ASSUMED |
| Collection revenues missing office_id (#182) | P0 | Present | Fixed in RC | ASSUMED |
| Autopilot unscoped task context (#183) | P1 | Present | Fixed in RC | ASSUMED |
| Session GUC `set_config(..., false)` | P0-class | Present | Present until #139 | ASSUMED |
| JLWM demo auto-seed on boot | P1 | Present | Gated (#185) | ASSUMED |
| DDL `DEFAULT 'default'` residue | P2 | Present | Partial | Schema debt |
| orgStructure heal-to-default (#171) | P1 residual | Present | Still invents on heal | Review |
| `__default__` retention templates | P2 design | Present | Present | Global templates |
| Actor `?? "unknown"` | P2 | Present | Present | Non-office |

No finding classified solely by string match without path analysis (prior program evidence reused + refreshed PR states).
