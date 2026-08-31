-- Deprecated compatibility stub.
--
-- The firework catalogue is now seeded by chronological migrations generated
-- from lib/fireworks/effect-catalogue.ts. This file is kept so older
-- local notes that reference it fail softly instead of reintroducing the old
-- renderer demo slugs.

do $$
begin
  raise notice 'seed-firework-designs.sql is deprecated; run migrations generated from lib/fireworks/effect-catalogue.ts instead.';
end
$$;
