# Risk Register

| ID | Severity | Risk | Mitigation |
|----|----------|------|------------|
| R-032R-01 | P0 | Exact 017–030 history lost from ephemeral VM | Custodian search; Gate B; else Fallback C |
| R-032R-02 | P0 | Proceeding to 033 without baseline | **STOP** — enforced |
| R-033-01 | P0 | Migration ID collision 061 vs recovered 061+ | Forward-only remap after inventory |
| R-033-02 | P1 | Silent feature gaps mistaken for complete product | Capability matrix + gap assessment |
| R-CONT-01 | P0 | Future LOCAL-ONLY loss | Durable continuity design (off-VM backup) |
