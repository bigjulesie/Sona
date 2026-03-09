-- Replace ivfflat embedding index with hnsw.
-- ivfflat built against an empty table (lists=100 without data) degrades to
-- a linear scan. hnsw provides consistent recall regardless of when the
-- index is built and scales well to millions of 1536-dim vectors.
--
-- m=16, ef_construction=64 are safe defaults. Increase ef_construction to
-- 128 for higher recall if query quality degrades at scale.

DROP INDEX IF EXISTS idx_knowledge_chunks_embedding;

CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
