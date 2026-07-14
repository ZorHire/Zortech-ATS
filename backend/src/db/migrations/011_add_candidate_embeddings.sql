-- Migration 011: pgvector-backed candidate embeddings for A3 (Matching/Sourcing).
-- Embeddings are generated from Gemini's embedContent endpoint (768-dim, MRL-truncated).
-- Jobs are NOT embedded — job/JD text is embedded on-the-fly at match time as the query vector.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

-- HNSW: no training step required (unlike IVFFlat), which matters here since there is
-- no embedded data yet to train against.
CREATE INDEX IF NOT EXISTS idx_candidates_embedding ON candidates
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
