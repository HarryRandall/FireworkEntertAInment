/** Static guards for the Blue Sphere renderer normalisation data migration. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('migration normalises effects and fireworks while preserving colour', () => {
  const migration = read(
    'supabase/migrations/20260618022759_normalise_fireworks_to_blue_sphere.sql',
  );

  assert.match(migration, /update public\.firework_effects/);
  assert.match(migration, /pattern_key = 'fibonacci'/);
  assert.match(migration, /model_json = pg_temp\.showcrafter_blue_sphere_effect_model\(\)/);
  assert.match(migration, /update public\.fireworks/);
  assert.match(migration, /showcrafter_firework_colour\(primary_color, render_overrides_json\)/);
  assert.match(migration, /showcrafter_hex_to_rgb\(primary_color\)/);
  assert.match(migration, /render_overrides #> '\{stars,outer,color\}'/);
  assert.match(migration, /render_overrides -> 'color'/);

  for (const fragment of [
    "'pattern', 'fibonacci'",
    "'geometry', 'sphere'",
    "'trailProfile', 'none'",
    "'crackle', jsonb_build_object(",
    "'strobe', jsonb_build_object('enabled', false)",
    "'split', jsonb_build_object('enabled', false)",
    "'burstTrail', jsonb_build_object(",
    "'particlesPerStar', 0",
  ]) {
    assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('legacy renderer seed is retired in favour of catalogue migrations', () => {
  const seed = read('supabase/seed-firework-designs.sql');

  assert.match(seed, /Deprecated compatibility stub/);
  assert.match(seed, /lib\/fireworks\/effect-catalogue\.ts/);
  assert.doesNotMatch(seed, /insert into public\.fireworks/);
  assert.doesNotMatch(seed, /'fib-[^']+'/);
});
