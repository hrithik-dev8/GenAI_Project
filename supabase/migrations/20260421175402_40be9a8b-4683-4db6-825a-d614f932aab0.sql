
-- Full-text search column + index
ALTER TABLE public.research_corpus
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(topic, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS research_corpus_tsv_idx
  ON public.research_corpus USING GIN (tsv);

-- Keyword retrieval RPC
CREATE OR REPLACE FUNCTION public.match_research_text(
  query_text text,
  match_count integer DEFAULT 5,
  topic_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, title text, authors text, year integer,
  source text, url text, topic text, content text, similarity double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', coalesce(query_text, '')) AS tsq
  )
  SELECT r.id, r.title, r.authors, r.year, r.source, r.url, r.topic, r.content,
         ts_rank(r.tsv, q.tsq)::double precision AS similarity
  FROM public.research_corpus r, q
  WHERE (topic_filter IS NULL OR r.topic = topic_filter)
    AND (q.tsq = ''::tsquery OR r.tsv @@ q.tsq)
  ORDER BY ts_rank(r.tsv, q.tsq) DESC, r.year DESC NULLS LAST
  LIMIT match_count;
$$;
