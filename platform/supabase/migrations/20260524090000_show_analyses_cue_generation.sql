-- Track automatic GPT cue generation alongside the librosa analysis row.
ALTER TABLE public.show_analyses
  ADD COLUMN IF NOT EXISTS cue_generation_status text
    NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cue_generation_error text,
  ADD COLUMN IF NOT EXISTS cue_count integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'show_analyses_cue_generation_status_check'
  ) THEN
    ALTER TABLE public.show_analyses
      ADD CONSTRAINT show_analyses_cue_generation_status_check
      CHECK (cue_generation_status IN ('pending','running','completed','failed','skipped'));
  END IF;
END$$;
