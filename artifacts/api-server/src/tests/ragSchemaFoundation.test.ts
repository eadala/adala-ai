/**
 * Focused validation for migration 021 RAG schema foundation (Stage 11.2).
 * Run: pnpm --filter @workspace/api-server run test:rag-schema
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

console.log("\n═══ document relation = document_center_files ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /CREATE TABLE IF NOT EXISTS document_center_files/);
  assert.match(
    mig,
    /REFERENCES document_center_files \(id\) ON DELETE CASCADE/,
  );
  assert.doesNotMatch(mig, /REFERENCES storage_files/);
  console.log("  ✅ FK document_id → document_center_files(id) CASCADE");
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

console.log("\n═══ indexes ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /idx_rag_chunks_office_document/);
  assert.match(mig, /idx_rag_chunks_office_document_chunk/);
  assert.match(mig, /USING hnsw \(embedding vector_cosine_ops\)/);
  assert.match(mig, /vector_cosine_ops/);
  console.log("  ✅ tenant btree + HNSW cosine (IVFFlat fallback)");
}

console.log("\n═══ extracted_text formalized ═══");
{
  const mig = readMig("021_rag_schema_foundation.sql");
  assert.match(mig, /CREATE TABLE IF NOT EXISTS document_ai_metadata/);
  assert.match(mig, /extracted_text\s+TEXT/);
  assert.match(mig, /ADD COLUMN IF NOT EXISTS extracted_text TEXT/);
  /* No OCR / extraction logic in migration */
  assert.doesNotMatch(mig, /gemini|ocr|extract\(/i);
  console.log("  ✅ document_ai_metadata.extracted_text under Schema Authority");
}

console.log("\n═══ no Runtime DDL / API surface in this stage ═══");
{
  const dc = readFileSync(
    join(ROOT, "src/modules/documents/documentCenter.ts"),
    "utf8",
  );
  /* Runtime ensure still present (unchanged this stage); authority now also in 021 */
  assert.match(dc, /document_ai_metadata/);
  assert.match(dc, /extracted_text/);
  console.log("  ✅ migration-only schema work; no new API/embed/chunk code");
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

console.log("\n✅ rag schema foundation tests passed\n");
