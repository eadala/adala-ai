# RLS Fail-Open Reproduction Evidence

**Environment:** Agent VM, PostgreSQL 16.15, database `adala_rls_repro`  
**Role:** `adala_app` (NOSUPERUSER, NOBYPASSRLS)  
**Date:** 2026-11-07 (Asia/Riyadh)  
**Git tip at write:** PR #138 recovery branch

## Setup (summary)

Table `client_invoices_repro` with rows office-a / office-b; policy matching Migration 057 fail-open USING; then replaced with 059-style fail-closed.

## Results

| Scenario | Fail-open (057) | Fail-closed (059) |
|----------|-----------------|-------------------|
| Missing tenant (NULL GUC) | **2 rows** | **0** |
| Empty `''` | **2** | **0** |
| `office-a` | 1 | 1 |
| `office-b` | 1 | 1 |
| `__unscoped__` | 0 | 0 |
| `bypass_rls=on` | 2 | 2 |

**Verdict:** Empty/missing tenant is a verified bypass under 057 semantics. Fail-closed policy + explicit bypass closes it while preserving valid tenant and privileged paths.

Commands archived in agent shell history; re-run via ephemeral PG using same SQL in this session transcript.
