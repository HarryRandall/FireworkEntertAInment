-- Persist ShowCrafter audio analyser runs for a show.
-- The API writes one row per local synchronous analyser run. RLS follows
-- show ownership so users can only read/write analyses for their own shows.

CREATE TABLE IF NOT EXISTS public.show_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version text,
  personality_preset text NOT NULL DEFAULT 'balanced',
  source_audio_path text NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  runtime_ms integer,
  analysis_json jsonb,
  compact_payload jsonb,
  markdown text,
  analysis_storage_path text,
  markdown_storage_path text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS show_analyses_show_id_created_at_idx
  ON public.show_analyses (show_id, created_at DESC);

CREATE INDEX IF NOT EXISTS show_analyses_user_id_created_at_idx
  ON public.show_analyses (user_id, created_at DESC);

ALTER TABLE public.show_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS show_analyses_select_via_show ON public.show_analyses;
CREATE POLICY show_analyses_select_via_show
  ON public.show_analyses
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.shows s
      WHERE s.id = show_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS show_analyses_insert_via_show ON public.show_analyses;
CREATE POLICY show_analyses_insert_via_show
  ON public.show_analyses
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.shows s
      WHERE s.id = show_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS show_analyses_update_via_show ON public.show_analyses;
CREATE POLICY show_analyses_update_via_show
  ON public.show_analyses
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.shows s
      WHERE s.id = show_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.shows s
      WHERE s.id = show_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS show_analyses_delete_via_show ON public.show_analyses;
CREATE POLICY show_analyses_delete_via_show
  ON public.show_analyses
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.shows s
      WHERE s.id = show_id
        AND s.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS show_analyses_set_updated_at ON public.show_analyses;
CREATE TRIGGER show_analyses_set_updated_at
  BEFORE UPDATE ON public.show_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.show_analyses TO authenticated;
