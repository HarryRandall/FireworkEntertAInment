#!/usr/bin/env node
/**
 * Generate the clean-slate firework catalogue reseed migration SQL from the
 * TypeScript catalogue in `lib/fireworks/effect-catalogue.ts`.
 *
 * The catalogue is the single source of truth: the dev firework lab imports it
 * to preview effects, and this generator transpiles it (its only import is a
 * type-only import that erases) and emits the SQL that seeds
 * `public.firework_effects` and `public.fireworks`. Re-run after editing the
 * catalogue to regenerate the migration.
 *
 *   node scripts/seed/generate-firework-catalogue-migration.mjs
 */
import ts from 'typescript';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformRoot = join(__dirname, '..', '..');
const cataloguePath = join(platformRoot, 'lib', 'fireworks', 'effect-catalogue.ts');

const src = readFileSync(cataloguePath, 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
    verbatimModuleSyntax: false,
  },
});
const tmpPath = join(platformRoot, '.tmp-catalogue.mjs');
writeFileSync(tmpPath, outputText);
const mod = await import(`${tmpPath}?t=${Date.now()}`).catch(async () => import(tmpPath));
// Clean up the transpiled scratch file after import.
try {
  await import('node:fs/promises').then((f) => f.unlink(tmpPath));
} catch {
  /* scratch cleanup is best-effort */
}

const { FIREWORK_EFFECT_CATALOGUE, CATALOGUE_FIREWORKS, catalogueEffectModelJson } = mod;

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonLiteral(value) {
  return sqlString(JSON.stringify(value));
}

function legacyGlitter(slug) {
  if (['brocade', 'kamuro'].includes(slug)) return 'heavy';
  if (['willow', 'palm', 'horsetail', 'waterfall'].includes(slug)) return 'willow';
  if (['strobe', 'crossette', 'crackle', 'double_break'].includes(slug)) return 'medium';
  if (['ring', 'saturn', 'pearls'].includes(slug)) return 'none';
  return 'light';
}

function variantJson(fw) {
  return {
    shellType: fw.shellType,
    spreadSize: fw.spreadSize,
    starLifeMs: fw.starLifeMs,
    starLifeVariation: 0.18,
    starDensity: 1,
    color: fw.primaryColor,
    colorPalette: fw.colorPalette,
    glitter: legacyGlitter(fw.effectSlug),
    crackle: fw.effectSlug === 'crackle',
    strobe: fw.effectSlug === 'strobe',
    ring: fw.effectSlug === 'ring' || fw.effectSlug === 'saturn',
    crossette: fw.effectSlug === 'crossette' || fw.effectSlug === 'double_break',
    horsetail: fw.effectSlug === 'horsetail',
  };
}

const ts7 = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp =
  `${ts7.getUTCFullYear()}${pad(ts7.getUTCMonth() + 1)}${pad(ts7.getUTCDate())}` +
  `${pad(ts7.getUTCHours())}${pad(ts7.getUTCMinutes())}${pad(ts7.getUTCSeconds())}`;

const lines = [];
lines.push(`-- Clean-slate reseed of the firework effect catalogue.`);
lines.push(`-- Generated from platform/lib/fireworks/effect-catalogue.ts by`);
lines.push(`-- scripts/seed/generate-firework-catalogue-migration.mjs. Re-run the`);
lines.push(`-- generator after editing the catalogue to refresh this file.`);
lines.push(`--`);
lines.push(`-- Upserts the calibrated set (${FIREWORK_EFFECT_CATALOGUE.length} effects,`);
lines.push(`-- ${CATALOGUE_FIREWORKS.length} coloured firework variants) tuned to the Brocade`);
lines.push(`-- reference bar, re-maps dependent catalogue_items and multishot_fireworks to the`);
lines.push(`-- nearest catalogue effect's default firework so existing show timelines keep`);
lines.push(`-- rendering. Legacy effects and fireworks not in the catalogue are pruned`);
lines.push(`-- after dependents are re-linked; retained style-default links and editor`);
lines.push(`-- versions stay attached to their upserted ids.`);
lines.push('');
lines.push(`-- Map old effect slugs to target catalogue effect slugs. Catalogue slugs`);
lines.push(`-- map to themselves; known legacy slugs remap to the nearest catalogue`);
lines.push(`-- effect; anything unmapped falls back to 'peony'.`);
lines.push(`create temp table if not exists _effect_remap (old_slug text, target_slug text);`);
lines.push(`insert into _effect_remap (old_slug, target_slug)`);
lines.push(`  select * from (values`);
FIREWORK_EFFECT_CATALOGUE.forEach((effect, index) => {
  const comma = index < FIREWORK_EFFECT_CATALOGUE.length - 1 ? ',' : '';
  lines.push(`    (${sqlString(effect.slug)}, ${sqlString(effect.slug)})${comma}`);
});
lines.push(`  ) as v(old_slug, target_slug);`);
lines.push(`insert into _effect_remap (old_slug, target_slug) values`);
lines.push(`  ('silver-fish', 'silverFish'),`);
lines.push(`  ('tail', 'comet'),`);
lines.push(`  ('custom-star-mqjgvfgo', 'peony'),`);
lines.push(`  ('legacy-effect-spec', 'peony');`);
lines.push('');
lines.push(`-- Capture dependent -> target catalogue effect slug before reseed.`);
lines.push(
  `create temp table if not exists _dep_effect_targets (src text, dep_id uuid, target_effect_slug text);`,
);
lines.push(`insert into _dep_effect_targets (src, dep_id, target_effect_slug)`);
lines.push(`  select 'catalogue_item'::text, ci.id, coalesce(r.target_slug, 'peony')`);
lines.push(`  from public.catalogue_items ci`);
lines.push(`  join public.fireworks fw on ci.firework_id = fw.id`);
lines.push(`  join public.firework_effects fe on fe.id = fw.firework_effect_id`);
lines.push(`  left join _effect_remap r on r.old_slug = fe.slug`);
lines.push(`  where ci.firework_id is not null;`);
lines.push(`insert into _dep_effect_targets (src, dep_id, target_effect_slug)`);
lines.push(`  select 'multishot_firework'::text, mf.id, coalesce(r.target_slug, 'peony')`);
lines.push(`  from public.multishot_fireworks mf`);
lines.push(`  join public.fireworks fw on mf.firework_id = fw.id`);
lines.push(`  join public.firework_effects fe on fe.id = fw.firework_effect_id`);
lines.push(`  left join _effect_remap r on r.old_slug = fe.slug`);
lines.push(`  where mf.firework_id is not null;`);
lines.push('');
lines.push(`-- Reseed base effects (upsert by slug). multishot_fireworks.firework_id is not`);
lines.push(`-- null with on-delete restrict, so effects/fireworks are upserted in place and`);
lines.push(`-- legacy rows are pruned only after dependents are re-linked below.`);
lines.push(`insert into public.firework_effects`);
lines.push(`  (slug, name, description, family, pattern_key, model_json, sort_order, source)`);
lines.push('values');
FIREWORK_EFFECT_CATALOGUE.forEach((effect, index) => {
  const modelJson = catalogueEffectModelJson(effect);
  const comma = index < FIREWORK_EFFECT_CATALOGUE.length - 1 ? ',' : '';
  lines.push(
    `  (${sqlString(effect.slug)}, ${sqlString(effect.name)}, ${sqlString(effect.description)}, ` +
      `${sqlString(effect.family)}, ${sqlString(effect.patternKey)}, ` +
      `${jsonLiteral(modelJson)}::jsonb, ${effect.sortOrder}, 'reference')${comma}`,
  );
});
lines.push(`on conflict (slug) do update set`);
lines.push(`  name = excluded.name,`);
lines.push(`  description = excluded.description,`);
lines.push(`  family = excluded.family,`);
lines.push(`  pattern_key = excluded.pattern_key,`);
lines.push(`  model_json = excluded.model_json,`);
lines.push(`  sort_order = excluded.sort_order,`);
lines.push(`  source = excluded.source,`);
lines.push(`  updated_at = now();`);
lines.push('');
lines.push(`-- Reseed coloured firework variants (default plus contrast colours per effect).`);
lines.push(`insert into public.fireworks (`);
lines.push(`  firework_effect_id, slug, name, description, primary_color, secondary_color,`);
lines.push(
  `  color_palette, duration_seconds, height_meters, variant_json, render_overrides_json,`,
);
lines.push(`  source, confidence`);
lines.push(`)`);
lines.push('select');
lines.push(`  fe.id,`);
lines.push(`  v.slug, v.name, v.description, v.primary_color, v.secondary_color,`);
lines.push(
  `  v.color_palette, v.duration_seconds, v.height_meters, v.variant_json, v.render_overrides_json,`,
);
lines.push(`  v.source, v.confidence`);
lines.push('from (values');
CATALOGUE_FIREWORKS.forEach((fw, index) => {
  const comma = index < CATALOGUE_FIREWORKS.length - 1 ? ',' : '';
  const row = [
    sqlString(fw.effectSlug),
    sqlString(fw.slug),
    sqlString(fw.name),
    sqlString(`Catalogue variant for ${fw.name}.`),
    sqlString(fw.primaryColor),
    sqlString(fw.secondaryColor),
    `array[${fw.colorPalette.map(sqlString).join(', ')}]::text[]`,
    String(fw.durationSeconds),
    String(fw.heightMeters),
    `${jsonLiteral(variantJson(fw))}::jsonb`,
    `'{}'::jsonb`,
    `'catalogue'`,
    '0.75',
  ];
  lines.push(`  (${row.join(', ')})${comma}`);
});
lines.push(
  `) as v(effect_slug, slug, name, description, primary_color, secondary_color, color_palette, duration_seconds, height_meters, variant_json, render_overrides_json, source, confidence)`,
);
lines.push(`join public.firework_effects fe on fe.slug = v.effect_slug`);
lines.push(`on conflict (slug) do update set`);
lines.push(`  firework_effect_id = excluded.firework_effect_id,`);
lines.push(`  name = excluded.name,`);
lines.push(`  description = excluded.description,`);
lines.push(`  primary_color = excluded.primary_color,`);
lines.push(`  secondary_color = excluded.secondary_color,`);
lines.push(`  color_palette = excluded.color_palette,`);
lines.push(`  duration_seconds = excluded.duration_seconds,`);
lines.push(`  height_meters = excluded.height_meters,`);
lines.push(`  variant_json = excluded.variant_json,`);
lines.push(`  render_overrides_json = excluded.render_overrides_json,`);
lines.push(`  source = excluded.source,`);
lines.push(`  confidence = excluded.confidence,`);
lines.push(`  updated_at = now();`);
lines.push('');
lines.push(`-- Re-link dependents to the new catalogue default firework for each target effect.`);
lines.push(`update public.catalogue_items ci`);
lines.push(`  set firework_id = nf.id`);
lines.push(`  from _dep_effect_targets d`);
lines.push(`  join public.firework_effects te on te.slug = d.target_effect_slug`);
lines.push(
  `  join public.fireworks nf on nf.firework_effect_id = te.id and nf.slug = te.slug || '-default'`,
);
lines.push(`  where d.src = 'catalogue_item' and ci.id = d.dep_id;`);
lines.push(`update public.multishot_fireworks mf`);
lines.push(`  set firework_id = nf.id`);
lines.push(`  from _dep_effect_targets d`);
lines.push(`  join public.firework_effects te on te.slug = d.target_effect_slug`);
lines.push(
  `  join public.fireworks nf on nf.firework_effect_id = te.id and nf.slug = te.slug || '-default'`,
);
lines.push(`  where d.src = 'multishot_firework' and mf.id = d.dep_id;`);
lines.push('');
lines.push(`-- Prune legacy fireworks no longer in the catalogue. Safe now: every dependent`);
lines.push(`-- points at a catalogue default firework after the re-link above.`);
lines.push(`delete from public.fireworks where slug not in (`);
lines.push(`  ${CATALOGUE_FIREWORKS.map((fw) => sqlString(fw.slug)).join(', ')}`);
lines.push(`);`);
lines.push('');
lines.push(`-- Prune legacy effects no longer in the catalogue. Safe now: the only fireworks`);
lines.push(`-- left are catalogue fireworks, all of which reference catalogue effects.`);
lines.push(`delete from public.firework_effects where slug not in (`);
lines.push(`  ${FIREWORK_EFFECT_CATALOGUE.map((effect) => sqlString(effect.slug)).join(', ')}`);
lines.push(`);`);
lines.push('');
lines.push(`drop table _dep_effect_targets;`);
lines.push(`drop table _effect_remap;`);
lines.push('');

const sql = lines.join('\n');
const migrationsDir = join(platformRoot, 'supabase', 'migrations');
mkdirSync(migrationsDir, { recursive: true });
const existingReseedMigration = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('_reseed_firework_catalogue_from_scratch.sql'))
  .sort()
  .at(-1);
const outPath = join(
  migrationsDir,
  existingReseedMigration ?? `${stamp}_reseed_firework_catalogue_from_scratch.sql`,
);
writeFileSync(outPath, sql);
console.log(
  `Wrote ${outPath} (${FIREWORK_EFFECT_CATALOGUE.length} effects, ${CATALOGUE_FIREWORKS.length} fireworks)`,
);
