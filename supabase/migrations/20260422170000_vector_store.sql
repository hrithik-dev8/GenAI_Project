-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Add an embedding column to the research_corpus table
-- Using vector(1536) since text-embedding-3-small and text-embedding-ada-002 use 1536 dimensions
ALTER TABLE public.research_corpus
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create a function to similarity search for research documents
-- This format is designed to be compatible with LangChain's SupabaseVectorStore
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
) RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.content,
    -- We construct a JSON metadata object because LangChain expects metadata in this format
    jsonb_build_object(
      'title', r.title,
      'authors', r.authors,
      'year', r.year,
      'source', r.source,
      'url', r.url,
      'topic', r.topic
    ) AS metadata,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM public.research_corpus r
  WHERE r.embedding IS NOT NULL
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
