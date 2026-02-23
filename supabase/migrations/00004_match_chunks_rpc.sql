CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_portrait_id UUID,
  match_count INTEGER DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_title TEXT,
  source_type TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.content,
    kc.source_title,
    kc.source_type,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.portrait_id = match_portrait_id
    AND kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
