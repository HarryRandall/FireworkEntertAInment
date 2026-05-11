-- Strip the third-party brand name from effect_specs.slug and shows.slug.
-- Effect slugs (e.g. lallassu-fib-blue) become bare names (fib-blue).
-- Show slugs (e.g. lallassu-pattern-check) become qa-* so the QA test
-- shows stay grouped together.

UPDATE public.effect_specs
SET slug = regexp_replace(slug, '^lallassu-', '')
WHERE slug LIKE 'lallassu-%';

UPDATE public.shows
SET slug = regexp_replace(slug, '^lallassu-', 'qa-')
WHERE slug LIKE 'lallassu-%';
