ALTER TABLE public.users
  ALTER COLUMN theme_preference SET DEFAULT 'system';

UPDATE public.users
SET theme_preference = 'system'
WHERE theme_preference IS NULL;
