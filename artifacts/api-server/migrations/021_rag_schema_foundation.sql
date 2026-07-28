-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 021: RAG Schema Foundation (Stage 11.2)
--
-- Owns:
--   CREATE EXTENSION vector (pgvector) — required, no float[] fallback
--   document_center_files formal CREATE (Schema Authority; Runtime DDL removed)
--   document_ai_metadata formal CREATE incl. extracted_text (Runtime DDL removed)
--   rag_chunks tenant-safe chunk + embedding store
--
-- Embedding dimension contract (Decision A — Stage 11.2 / 11.3):
--   Column: embedding vector(1536)
--   Approved production contract: OpenAI text-embedding-3-small (1536 dims)
--     (also the default output size for OpenAI-compatible 1536-dim APIs).
--   Repo today: chat providers only (Gemini / Claude / GPT). No EMBEDDING_MODEL
--     env or embedding call site exists yet — Stage 11.3 has not selected a
--     production embedding provider beyond this schema contract.
--   Stage 11.3 MUST:
--     1) configure exactly one embedding model whose output dimension is 1536;
--     2) reject / fail closed on any model or response with dim ≠ 1536;
--     3) ship a follow-up migration BEFORE changing this column type if a
--        different dimension is later approved (no silent ALTER of vector(N)).
--   Do NOT speculate on Gemini embedding dims here — chat ≠ embeddings.
--
-- Document relation (tenant-safe):
--   UNIQUE (office_id, id) on document_center_files
--   rag_chunks (office_id, document_id)
--     → document_center_files (office_id, id) ON DELETE CASCADE
--   Prevents a chunk from referencing another office's document at DB level.
--   (Document Center is the RAG corpus; storage_files is separate — unused here.)
--
-- Indexes retained:
--   UNIQUE (office_id, document_id, chunk_index) — tenant-doc lookup + ordered chunks
--   HNSW (embedding vector_cosine_ops) — vector similarity (deterministic; no IVFFlat)
--
-- Apply AFTER: … → 019 → 020
-- Requires: PostgreSQL with pgvector ≥ 0.5 (HNSW)
--   (e.g. image pgvector/pgvector:pg16 — NOT stock postgres:alpine)
-- Idempotent / legacy-safe. Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1) pgvector — fail hard if unavailable (no fallback schema) ────────────
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN undefined_file THEN
    RAISE EXCEPTION
      '021_rag: pgvector extension is not available on this PostgreSQL. '
      'Install pgvector or use image pgvector/pgvector:pg16 (or equivalent). '
      'No float[] / JSON embedding fallback is permitted.';
  WHEN feature_not_supported THEN
    RAISE EXCEPTION
      '021_rag: pgvector is not supported on this PostgreSQL build. '
      'Use a pgvector-enabled server image.';
END $$;

-- ── 2) document_center_files (Schema Authority for existing Runtime table) ─
-- Column set derived from former documentCenter.ts ensureDocumentCenterSchema().
-- office_id is TEXT NOT NULL (tenant key); id is TEXT PK.
CREATE TABLE IF NOT EXISTS document_center_files (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id        TEXT NOT NULL,
  source_table     TEXT NOT NULL,
  source_id        TEXT NOT NULL,
  storage_key      TEXT,
  storage_provider TEXT DEFAULT 'db_base64',
  file_name        TEXT,
  file_size        BIGINT DEFAULT 0,
  mime_type        TEXT,
  checksum         TEXT,
  legal_category   TEXT,
  tags             TEXT[],
  case_id          TEXT,
  client_id        TEXT,
  contract_id      TEXT,
  uploaded_by      TEXT,
  uploaded_by_name TEXT,
  is_archived      BOOLEAN DEFAULT FALSE,
  version          INT DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS storage_provider TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS legal_category TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS contract_id TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS is_archived BOOLEAN;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS version INT;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE document_center_files ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Tenant key must be NOT NULL before composite FK / UNIQUE (office_id, id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM document_center_files WHERE office_id IS NULL
  ) THEN
    RAISE EXCEPTION
      '021_rag: document_center_files.office_id contains NULL; '
      'backfill office_id before applying tenant-safe RAG FK.';
  END IF;
  ALTER TABLE document_center_files ALTER COLUMN office_id SET NOT NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Composite FK target: (office_id, id) must be UNIQUE (id alone is PK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_center_files_office_id_id_key'
  ) THEN
    ALTER TABLE document_center_files
      ADD CONSTRAINT document_center_files_office_id_id_key
      UNIQUE (office_id, id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_dcf_office_id
  ON document_center_files (office_id);
CREATE INDEX IF NOT EXISTS idx_dcf_case_id
  ON document_center_files (case_id)
  WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dcf_category
  ON document_center_files (office_id, legal_category);

-- ── 3) document_ai_metadata + extracted_text (formalize Runtime DDL) ───────
CREATE TABLE IF NOT EXISTS document_ai_metadata (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id      TEXT NOT NULL,
  office_id        TEXT NOT NULL,
  extracted_text   TEXT,
  summary          TEXT,
  document_type    TEXT,
  parties          TEXT[],
  dates            TEXT[],
  obligations      TEXT[],
  amounts          TEXT[],
  keywords         TEXT[],
  confidence_score DOUBLE PRECISION DEFAULT 0,
  processed_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (document_id)
);

ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS parties TEXT[];
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS dates TEXT[];
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS obligations TEXT[];
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS amounts TEXT[];
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS keywords TEXT[];
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;
ALTER TABLE document_ai_metadata ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'document_ai_metadata'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(document_id)%'
  ) THEN
    ALTER TABLE document_ai_metadata
      ADD CONSTRAINT document_ai_metadata_document_id_key UNIQUE (document_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_dam_doc_id
  ON document_ai_metadata (document_id);
CREATE INDEX IF NOT EXISTS idx_dam_office
  ON document_ai_metadata (office_id);

-- ── 4) rag_chunks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rag_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  document_id  TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(1536),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_chunks_chunk_index_nonneg CHECK (chunk_index >= 0),
  CONSTRAINT rag_chunks_content_nonempty CHECK (length(btrim(content)) > 0),
  CONSTRAINT rag_chunks_office_document_chunk_uq
    UNIQUE (office_id, document_id, chunk_index),
  CONSTRAINT rag_chunks_office_document_fkey
    FOREIGN KEY (office_id, document_id)
    REFERENCES document_center_files (office_id, id)
    ON DELETE CASCADE
);

-- Idempotent column repairs for partial/legacy creates
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- embedding column: add only if missing (type vector(1536) requires extension)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rag_chunks'
      AND column_name = 'embedding'
  ) THEN
    ALTER TABLE rag_chunks ADD COLUMN embedding vector(1536);
  END IF;
END $$;

ALTER TABLE rag_chunks ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE rag_chunks ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE rag_chunks ALTER COLUMN updated_at SET DEFAULT NOW();

-- CHECKs (skip if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rag_chunks_chunk_index_nonneg'
  ) THEN
    ALTER TABLE rag_chunks
      ADD CONSTRAINT rag_chunks_chunk_index_nonneg CHECK (chunk_index >= 0);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rag_chunks_content_nonempty'
  ) THEN
    ALTER TABLE rag_chunks
      ADD CONSTRAINT rag_chunks_content_nonempty
      CHECK (length(btrim(content)) > 0);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rag_chunks_office_document_chunk_uq'
  ) THEN
    ALTER TABLE rag_chunks
      ADD CONSTRAINT rag_chunks_office_document_chunk_uq
      UNIQUE (office_id, document_id, chunk_index);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Replace legacy single-column document FK with composite tenant FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rag_chunks_document_id_fkey'
  ) THEN
    ALTER TABLE rag_chunks DROP CONSTRAINT rag_chunks_document_id_fkey;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rag_chunks_office_document_fkey'
  ) AND to_regclass('public.document_center_files') IS NOT NULL THEN
    ALTER TABLE rag_chunks
      ADD CONSTRAINT rag_chunks_office_document_fkey
      FOREIGN KEY (office_id, document_id)
      REFERENCES document_center_files (office_id, id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- ── 5) Indexes ─────────────────────────────────────────────────────────────
-- Tenant-document lookup + ordered chunks: covered by
--   UNIQUE (office_id, document_id, chunk_index)
--   (leftmost prefix serves (office_id, document_id) lookups).
-- Drop redundant btree indexes if an earlier 021 revision created them.
DROP INDEX IF EXISTS idx_rag_chunks_office_document;
DROP INDEX IF EXISTS idx_rag_chunks_office_document_chunk;

-- Tenant-scoped vector similarity (cosine). HNSW requires pgvector ≥ 0.5.
-- Deterministic: fail the migration if HNSW cannot be created (no IVFFlat).
-- Queries MUST still filter office_id in WHERE for tenant isolation.
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
    ON rag_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION
      '021_rag: HNSW index idx_rag_chunks_embedding_hnsw is required '
      '(deterministic production schema). Use pgvector ≥ 0.5 '
      '(e.g. image pgvector/pgvector:pg16). No IVFFlat / silent fallback. (%).',
      SQLERRM;
END $$;

COMMIT;
