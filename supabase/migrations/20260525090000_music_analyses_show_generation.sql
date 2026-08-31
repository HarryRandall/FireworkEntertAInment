-- Separate upload-scoped music analysis from show cue generation.

CREATE TABLE IF NOT EXISTS public.music_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_path text NOT NULL,
  original_filename text,
  content_type text,
  size_bytes bigint,
  schema_version text NOT NULL DEFAULT '1.2.0',
  personality text NOT NULL DEFAULT 'balanced',
  runner_version text,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  runtime_ms integer,
  analysis_json jsonb,
  markdown text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS music_analyses_user_id_created_at_idx
  ON public.music_analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS music_analyses_audio_path_idx
  ON public.music_analyses (audio_path);

ALTER TABLE public.music_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS music_analyses_select_own ON public.music_analyses;
CREATE POLICY music_analyses_select_own
  ON public.music_analyses
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS music_analyses_insert_own ON public.music_analyses;
CREATE POLICY music_analyses_insert_own
  ON public.music_analyses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS music_analyses_update_own ON public.music_analyses;
CREATE POLICY music_analyses_update_own
  ON public.music_analyses
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS music_analyses_delete_own ON public.music_analyses;
CREATE POLICY music_analyses_delete_own
  ON public.music_analyses
  FOR DELETE
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS music_analyses_set_updated_at ON public.music_analyses;
CREATE TRIGGER music_analyses_set_updated_at
  BEFORE UPDATE ON public.music_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_analyses TO authenticated;

ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS music_analysis_id uuid
    REFERENCES public.music_analyses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS generation_error text,
  ADD COLUMN IF NOT EXISTS generated_cue_count integer,
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS shows_music_analysis_id_idx
  ON public.shows (music_analysis_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shows_generation_status_check'
  ) THEN
    ALTER TABLE public.shows
      ADD CONSTRAINT shows_generation_status_check
      CHECK (generation_status IN ('idle','running','completed','failed'));
  END IF;
END$$;
