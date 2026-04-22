
CREATE OR REPLACE FUNCTION public.match_research_text(
  query_text text,
  match_count integer DEFAULT 5,
  topic_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, title text, authors text, year integer,
  source text, url text, topic text, content text, similarity double precision
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned text;
  or_query text;
  tsq tsquery;
BEGIN
  cleaned := regexp_replace(coalesce(query_text, ''), '[^a-zA-Z0-9\s]', ' ', 'g');
  cleaned := trim(regexp_replace(cleaned, '\s+', ' ', 'g'));
  IF cleaned = '' THEN
    RETURN QUERY
      SELECT r.id, r.title, r.authors, r.year, r.source, r.url, r.topic, r.content, 0::double precision
      FROM public.research_corpus r
      WHERE (topic_filter IS NULL OR r.topic = topic_filter)
      ORDER BY r.year DESC NULLS LAST
      LIMIT match_count;
    RETURN;
  END IF;
  or_query := array_to_string(string_to_array(cleaned, ' '), ' | ');
  BEGIN
    tsq := to_tsquery('english', or_query);
  EXCEPTION WHEN others THEN
    tsq := plainto_tsquery('english', cleaned);
  END;
  RETURN QUERY
    SELECT r.id, r.title, r.authors, r.year, r.source, r.url, r.topic, r.content,
           ts_rank(r.tsv, tsq)::double precision AS similarity
    FROM public.research_corpus r
    WHERE (topic_filter IS NULL OR r.topic = topic_filter)
      AND r.tsv @@ tsq
    ORDER BY ts_rank(r.tsv, tsq) DESC, r.year DESC NULLS LAST
    LIMIT match_count;
END;
$$;
