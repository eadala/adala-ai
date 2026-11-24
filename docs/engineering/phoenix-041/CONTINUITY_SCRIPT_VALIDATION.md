# Continuity Script Validation

Scripts updated: fail-closed when `REQUIRE_EXTERNAL_BACKUP=1`; missing-object failures.

Synthetic tests: `evidence/continuity-synthetic-tests.txt`

- missing bundle → EXPECTED_FAIL
- REQUIRE_EXTERNAL=1 → EXPECTED_FAIL  
- clean bundle → LOCAL_BUNDLE_INTEGRITY_VERIFIED

Remote sync: **not activated**.
