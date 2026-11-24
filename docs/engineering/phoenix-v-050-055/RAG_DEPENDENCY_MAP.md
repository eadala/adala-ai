# RAG Dependency Map (Phoenix V)

## Present in tip

| Layer | Status | Location |
|-------|--------|----------|
| Schema / pgvector | PRESENT | `migrations/021_rag_schema_foundation.sql` |
| Document center corpus | PRESENT | `modules/documents/documentCenter.ts` |
| Embedding provider (prod) | MISSING | Contract: OpenAI `text-embedding-3-small` 1536-dim |
| Chunking / ingest pipeline | NEW (foundation) | `src/lib/rag/chunking.ts`, `secureRag.ts` |
| Tenant-scoped retrieval | NEW (foundation) | `src/lib/rag/memoryStore.ts` + service |
| HTTP RAG routes | NOT YET | deferred until provider + DB store approved |
| Cross-tenant vector search protection | DB FK + NEW service checks | 021 FK + `RAG_TENANT_*` errors |
| Citation / evidence separation | NEW | `evidenceKind` + `wrapRetrievedEvidence` |
| Prompt-injection hardening | NEW | evidence wrappers |
| Reindex/delete | NEW | `deleteDocument` / ingest replace |

## Security requirements mapped

- Tenant isolation at ingest/retrieve: **enforced in SecureRagService**
- Document-level filter: optional `documentIds`
- No client tenant override: `RAG_TENANT_OVERRIDE_REJECTED`
- Deleted docs: delete clears chunks
- No external embed calls in foundation: MockEmbeddingProvider only
- No production vector DB changes this phase

## Approval decision needed for production RAG

1. Authorize embedding provider credentials + data-handling policy.
2. Implement Postgres/`rag_chunks` store adapter (pgvector) behind same interface.
3. Wire HTTP routes with `requireAuthWithTenant`.
4. Evaluation harness with synthetic multi-tenant fixtures.
