/**
 * Focused validation for migration 021 RAG schema foundation (Stage 11.2).
 * Run: pnpm --filter @workspace/api-server run test:rag-schema
 *
 * Live tenant-mismatch INSERT checks live in
 * scripts/db/test-migrations.integration.sh (requires pgvector).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(ROOT, "migrations");
const repoRoot = join(ROOT, "..", "..");

function readMig(name: string) {
  return readFileSync(join(migrationsDir, name), "utf8");
}

console.log("\n═══ migration 021 present ═══");
{
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.includes("020_performance_hotpath_indexes.sql"));
  assert.ok(files.includes("021_rag_schema_foundation.sql"));
  assert.ok(
    files.indexOf("021_rag_schema_foundation.sql") >
      files.indexOf("020_performance_hotpath_indexes.sql"),
  );
  console.log("  ✅ 021 follows 020");
}

console.log("\n═══ pgvector required (no float[] fallback) ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /CREATE EXTENSION IF NOT EXISTS vector/);
  assert.match(mig, /undefined_file/);
  assert.match(mig, /No float\[] \/ JSON embedding fallback is permitted/);
  assert.doesNotMatch(mig, /float8\[\]|REAL\[\]|DOUBLE PRECISION\[\]/);
  assert.match(mig, /vector\(1536\)/);
  console.log("  ✅ vector(1536); hard-fail if extension missing");
}

console.log("\n═══ embedding dimension contract (Decision A) ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /Decision A/);
  assert.match(mig, /text-embedding-3-small/);
  assert.match(mig, /Stage 11\.3 MUST/);
  assert.match(mig, /dim (?:!==|≠) 1536|dimension is 1536/);
  const aiRegistry = readFileSync(
    join(ROOT, "src/lib/aiRegistry.ts"),
    "utf8",
  );
  assert.doesNotMatch(aiRegistry, /embedding|text-embedding/i);
  console.log("  ✅ keep vector(1536); Stage 11.3 must enforce compatible model");
}

console.log("\n═══ composite tenant FK → document_center_files ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /CREATE TABLE IF NOT EXISTS document_center_files/);
  assert.match(mig, /document_center_files_office_id_id_key/);
  assert.match(mig, /UNIQUE \(office_id, id\)/);
  assert.match(
    mig,
    /FOREIGN KEY \(office_id, document_id\)\s+REFERENCES document_center_files \(office_id, id\)\s+ON DELETE CASCADE/s,
  );
  assert.match(mig, /rag_chunks_office_document_fkey/);
  assert.doesNotMatch(
    mig,
    /REFERENCES document_center_files \(id\) ON DELETE CASCADE/,
  );
  assert.doesNotMatch(mig, /REFERENCES storage_files/);
  console.log("  ✅ FK (office_id, document_id) → (office_id, id) CASCADE");
}

console.log("\n═══ rag_chunks constraints ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /office_id\s+TEXT NOT NULL/);
  assert.match(mig, /document_id\s+TEXT NOT NULL/);
  assert.match(mig, /rag_chunks_chunk_index_nonneg/);
  assert.match(mig, /chunk_index >= 0/);
  assert.match(mig, /rag_chunks_content_nonempty/);
  assert.match(mig, /length\(btrim\(content\)\) > 0/);
  assert.match(mig, /UNIQUE \(office_id, document_id, chunk_index\)/);
  assert.match(mig, /metadata\s+JSONB/);
  assert.match(mig, /created_at\s+TIMESTAMPTZ/);
  assert.match(mig, /updated_at\s+TIMESTAMPTZ/);
  console.log("  ✅ office/document required; chunk uniqueness; content non-empty");
}

console.log("\n═══ indexes (no redundant btree; deterministic HNSW) ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /DROP INDEX IF EXISTS idx_rag_chunks_office_document/);
  assert.match(mig, /DROP INDEX IF EXISTS idx_rag_chunks_office_document_chunk/);
  assert.doesNotMatch(mig, /CREATE INDEX IF NOT EXISTS idx_rag_chunks_office_document[^_]/);
  assert.doesNotMatch(
    mig,
    /CREATE INDEX IF NOT EXISTS idx_rag_chunks_office_document_chunk/,
  );
  assert.match(mig, /USING hnsw \(embedding vector_cosine_ops\)/);
  assert.match(mig, /No IVFFlat \/ silent fallback/);
  assert.doesNotMatch(mig, /USING ivfflat/i);
  assert.doesNotMatch(mig, /RAISE WARNING[\s\S]*vector index/i);
  console.log("  ✅ UNIQUE covers tenant/order; HNSW only (fail-hard)");
}

console.log("\n═══ extracted_text formalized ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /CREATE TABLE IF NOT EXISTS document_ai_metadata/);
  assert.match(mig, /extracted_text\s+TEXT/);
  assert.match(mig, /ADD COLUMN IF NOT EXISTS extracted_text TEXT/);
  /* Executable SQL only — comments may mention providers for the dim contract */
  const sqlBody = mig
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  assert.doesNotMatch(sqlBody, /gemini|ocr|extract\s*\(/i);
  console.log("  ✅ document_ai_metadata.extracted_text under Schema Authority");
}

console.log("\n═══ Runtime DDL removed for 021-owned tables ═══");
{
  const dc = readFileSync(
    join(ROOT, "src/modules/documents/documentCenter.ts"),
    "utf8",
  );
  assert.match(dc, /021_rag_schema_foundation/);
  assert.match(dc, /to_regclass\('public\.document_center_files'\)/);
  assert.doesNotMatch(
    dc,
    /CREATE TABLE IF NOT EXISTS document_center_files/,
  );
  assert.doesNotMatch(
    dc,
    /CREATE TABLE IF NOT EXISTS document_ai_metadata/,
  );
  assert.doesNotMatch(dc, /idx_dcf_office_id/);
  assert.doesNotMatch(dc, /idx_dam_doc_id/);
  assert.doesNotMatch(dc, /ALTER TABLE document_center_files/);
  assert.doesNotMatch(dc, /ALTER TABLE document_ai_metadata/);
  console.log("  ✅ ensureDocumentCenterSchema: read-only readiness only");
}

console.log("\n═══ infra: docker-compose uses pgvector image ═══");
{
  const compose = readFileSync(join(repoRoot, "docker-compose.yml"), "utf8");
  assert.match(compose, /pgvector\/pgvector:pg16/);
  assert.doesNotMatch(compose, /image:\s*postgres:16-alpine/);
  const init = readFileSync(join(repoRoot, "infra/postgres/init.sql"), "utf8");
  assert.match(init, /CREATE EXTENSION IF NOT EXISTS "vector"/);
  console.log("  ✅ compose + init.sql require pgvector");
}

console.log("\n═══ negative schema: cross-office chunk cannot satisfy composite FK ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  /* Single-column document_id FK would allow office_id ≠ document.office_id.
     Composite FK makes that pair illegal at the database layer.
     Live INSERT rejection is covered by scripts/db/test-migrations.integration.sh
     scenario_migration_021_rag_tenant_fk (requires pgvector). */
  assert.match(mig, /rag_chunks_office_document_fkey/);
  assert.match(
    mig,
    /FOREIGN KEY \(office_id, document_id\)\s+REFERENCES document_center_files \(office_id, id\)/s,
  );
  assert.doesNotMatch(
    mig,
    /ADD CONSTRAINT rag_chunks_document_id_fkey|REFERENCES document_center_files \(id\) ON DELETE CASCADE/,
  );
  /* Legacy single-column FK must be dropped if present */
  assert.match(mig, /DROP CONSTRAINT rag_chunks_document_id_fkey/);
  console.log("  ✅ schema forbids cross-office document_id pairing");
}

console.log("\n✅ rag schema foundation tests passed\n");
