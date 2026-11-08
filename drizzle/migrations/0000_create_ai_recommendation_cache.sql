CREATE TABLE public.ai_recommendation_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.ai_recommendation_cache TO service_role;
ALTER TABLE public.ai_recommendation_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_recommendation_cache_expiry_idx ON public.ai_recommendation_cache (expires_at);
COMMENT ON TABLE public.ai_recommendation_cache IS 'Server-only cache of Claude-generated restaurant names, prices, and similarity ratings; never stores Google Places responses.';