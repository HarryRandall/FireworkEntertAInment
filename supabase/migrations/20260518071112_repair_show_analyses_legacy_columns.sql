-- Align already-created show_analyses tables with the current music analysis
-- contract. Older environments may still have the legacy columns as NOT NULL,
-- which blocks inserts that write the new audio_path/personality/llm_payload
-- fields.

ALTER TABLE public.show_analyses
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS personality text,
  ADD COLUMN IF NOT EXISTS runner_version text,
  ADD COLUMN IF NOT EXISTS llm_payload jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
DECLARE
  has_source_audio_path boolean;
  has_personality_preset boolean;
  has_compact_payload boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'show_analyses'
      AND column_name = 'source_audio_path'
  ) INTO has_source_audio_path;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'show_analyses'
      AND column_name = 'personality_preset'
  ) INTO has_personality_preset;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'show_analyses'
      AND column_name = 'compact_payload'
  ) INTO has_compact_payload;

  IF has_source_audio_path THEN
    UPDATE public.show_analyses
    SET audio_path = COALESCE(audio_path, source_audio_path)
    WHERE audio_path IS NULL;
  END IF;

  IF has_personality_preset THEN
    UPDATE public.show_analyses
    SET personality = COALESCE(personality, personality_preset, 'balanced')
    WHERE personality IS NULL;
  ELSE
    UPDATE public.show_analyses
    SET personality = COALESCE(personality, 'balanced')
    WHERE personality IS NULL;
  END IF;

  IF has_compact_payload THEN
    UPDATE public.show_analyses
    SET llm_payload = COALESCE(llm_payload, compact_payload)
    WHERE llm_payload IS NULL;
  END IF;

  UPDATE public.show_analyses
  SET schema_version = COALESCE(schema_version, '1.2.0')
  WHERE schema_version IS NULL;
END $$;

ALTER TABLE public.show_analyses
  ALTER COLUMN audio_path SET NOT NULL,
  ALTER COLUMN personality SET DEFAULT 'balanced',
  ALTER COLUMN personality SET NOT NULL,
  ALTER COLUMN schema_version SET DEFAULT '1.2.0',
  ALTER COLUMN schema_version SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'show_analyses'
      AND column_name = 'source_audio_path'
  ) THEN
    ALTER TABLE public.show_analyses
      ALTER COLUMN source_audio_path DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'show_analyses'
      AND column_name = 'personality_preset'
  ) THEN
    ALTER TABLE public.show_analyses
      ALTER COLUMN personality_preset DROP NOT NULL;
  END IF;
END $$;
