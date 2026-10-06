import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { effectTemplates, upgradeDesign, shotDuration } from '../../packages/renderer/src/index.ts';
import { FireworkDesignSchema } from '../../packages/fireworks/src/model/design-schema.ts';
import { catalogueDesign, matchTemplate, templateSlug } from './designs.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BOOTSTRAP = join(ROOT, 'supabase/bootstrap');
export const MIGRATION_PATH = 'supabase/migrations/20261006000200_catalogue_renderer_designs.sql';
// Content timestamps are fixed to the catalogue generation epoch, UTC.
const CONTENT_TIMESTAMP_UTC = '2026-10-06T00:00:00+00:00';
const MAPPING = {
  double_break: 'multiBreak',
  roman_candle: 'romanCandle',
  silverFish: 'fish',
  whirl: 'whirlwind',
  five_point_star: 'fivePointStar',
};

function read(table) {
  return JSON.parse(readFileSync(join(BOOTSTRAP, `${table}.json`), 'utf8'));
}
function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function id(identity) {
  const bytes = createHash('sha256').update(`showcrafter-renderer-catalogue:${identity}`).digest();
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function literal(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}
function insert(table, row, replacements = {}) {
  const columns = Object.keys(row);
  return `insert into public.${table} (${columns.join(', ')})\nselect ${columns.map((column) => replacements[column] ?? `r.${column}`).join(', ')}\nfrom jsonb_populate_record(null::public.${table}, ${literal(row)}) r`;
}
function preview(target, targetId, example) {
  return {
    ...Object.fromEntries(Object.keys(example).map((key) => [key, null])),
    id: id(`preview:${target}:${targetId}`),
    [target]: targetId,
    source_revision: 1,
    created_at: CONTENT_TIMESTAMP_UTC,
    updated_at: CONTENT_TIMESTAMP_UTC,
  };
}

/** Builds deterministic bootstrap rows, review evidence and a guarded content migration. */
export function buildCatalogue() {
  const effects = read('firework_effects').filter((row) => !row.slug.startsWith('renderer-'));
  const fireworks = read('fireworks').filter((row) => !row.slug.startsWith('renderer-'));
  const items = read('catalogue_items').filter((row) => !row.part_number.startsWith('renderer-'));
  const generatedIds = new Set(
    ['firework_effects', 'fireworks'].flatMap((table) =>
      read(table)
        .filter((row) => row.slug.startsWith('renderer-'))
        .map((row) => row.id),
    ),
  );
  const previews = read('firework_preview_images').filter(
    (row) => !generatedIds.has(row.firework_effect_id ?? row.firework_id),
  );
  const templates = new Map(effectTemplates.map((template) => [template.key, template]));
  const effectById = new Map(effects.map((effect) => [effect.id, effect]));
  const effectMappings = effects.map((effect) => {
    const key = MAPPING[effect.pattern_key] ?? effect.pattern_key;
    const template = templates.get(key);
    if (!template) throw new Error(`Missing template for ${effect.slug}`);
    effect.design = upgradeDesign(template.design, 1);
    effect.template_key = key;
    return {
      slug: effect.slug,
      patternKey: effect.pattern_key,
      templateKey: key,
      oldGeometry: effect.model_json.geometry,
      oldTrailProfile: effect.model_json.trailProfile,
      templateKind: template.design.kind,
      templatePatterns: template.design.breaks.flatMap((burst) =>
        burst.layers.map((layer) => layer.pattern),
      ),
      templateModifiers: template.design.breaks.flatMap((burst) =>
        burst.layers.flatMap((layer) => layer.modifiers.map((modifier) => modifier.kind)),
      ),
      review: 'Base effect retains its mapped renderer template unchanged.',
    };
  });
  const usage = new Map();
  const review = [...fireworks]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((firework) => {
      const effect = effectById.get(firework.firework_effect_id);
      if (!effect) throw new Error(`Missing effect for ${firework.slug}`);
      const match = matchTemplate(firework, effect, usage);
      const template = templates.get(match.key);
      if (!template) throw new Error(`Missing template ${match.key}`);
      firework.design = catalogueDesign(template.design, firework);
      return {
        slug: firework.slug,
        name: firework.name,
        templateKey: match.key,
        templateName: template.name,
        reason: match.reason,
        notes: [match.reason],
      };
    });
  const used = new Set(effects.map((effect) => effect.template_key));
  const additions = [];
  const oldPlaceholder = FireworkDesignSchema.parse({ geometry: 'sphere', trailProfile: 'none' });
  for (const template of effectTemplates) {
    if (used.has(template.key)) continue;
    const slug = templateSlug(template.key);
    const description =
      template.description ??
      `${template.name}. Renderer library ${template.group.toLowerCase()} template.`;
    const effect = {
      ...effects[0],
      id: id(`effect:${slug}`),
      slug,
      name: template.name,
      description,
      pattern_key: template.key,
      model_json: { version: 3, geometry: 'sphere', trailProfile: 'none' },
      sort_order: effects.length,
      source: 'reference',
      created_at: CONTENT_TIMESTAMP_UTC,
      updated_at: CONTENT_TIMESTAMP_UTC,
      design: template.design,
      design_schema: 1,
      template_key: template.key,
    };
    const firework = {
      ...fireworks[0],
      id: id(`firework:${slug}`),
      firework_effect_id: effect.id,
      slug,
      name: template.name,
      description,
      primary_color: null,
      secondary_color: null,
      color_palette: [],
      caliber: null,
      duration_seconds: shotDuration(template.design),
      height_meters: template.design.kind === 'shell' ? template.design.launch.height_m : null,
      variant_json: {},
      render_overrides_json: oldPlaceholder,
      render_snapshot_json: oldPlaceholder,
      source: 'catalogue',
      confidence: 1,
      created_at: CONTENT_TIMESTAMP_UTC,
      updated_at: CONTENT_TIMESTAMP_UTC,
      design: template.design,
      design_schema: 1,
    };
    const item = {
      ...items[0],
      id: id(`item:${slug}`),
      part_number: slug,
      name: template.name,
      manufacturer: null,
      description,
      catalogue_item_kind: 'firework',
      firework_id: firework.id,
      multishot_id: null,
      firework_type: template.design.kind,
      duration_seconds: Math.round(shotDuration(template.design) * 100) / 100,
      metadata: {},
      is_listed: false,
      finale_product_id: null,
      finale_effect_name: null,
      created_at: CONTENT_TIMESTAMP_UTC,
      updated_at: CONTENT_TIMESTAMP_UTC,
    };
    effects.push(effect);
    fireworks.push(firework);
    items.push(item);
    previews.push(
      preview('firework_effect_id', effect.id, previews[0]),
      preview('firework_id', firework.id, previews[0]),
    );
    additions.push({ effect, firework, item });
  }
  const sql = [
    '-- Generated by scripts/catalogue/generate.mjs. Only missing designs and library identities are written.',
    'begin;',
    readFileSync(new URL('./adapt-design.sql', import.meta.url), 'utf8'),
    'do $catalogue$ begin',
    '-- Empty databases receive content through bootstrap; do not pre-populate them.',
    'if exists (select 1 from public.firework_effects) then',
  ];
  for (const mapping of effectMappings) {
    const effect = effects.find((effect) => effect.slug === mapping.slug);
    const slug = mapping.slug.replaceAll("'", "''");
    sql.push(
      `update public.firework_effects set design = ${literal(effect.design)} where slug = '${slug}' and design is null;`,
      `update public.firework_effects set template_key = '${mapping.templateKey}' where slug = '${slug}' and template_key is null and not exists (select 1 from public.firework_effects where template_key = '${mapping.templateKey}');`,
    );
  }
  // Match live effects by slug as well as fireworks. Never assume the exported UUIDs exist.
  for (const firework of fireworks.slice(0, review.length)) {
    const effect = effectById.get(firework.firework_effect_id);
    const mapping = review.find((row) => row.slug === firework.slug);
    const mapped = templates.get(mapping.templateKey).design;
    sql.push(
      `update public.fireworks f set design = pg_temp.catalogue_design(${literal(mapped)}, f.color_palette, f.primary_color, f.secondary_color, ${firework.design.seed})\nwhere f.slug = '${firework.slug.replaceAll("'", "''")}' and f.design is null\nand exists (select 1 from public.firework_effects e where e.id = f.firework_effect_id and e.slug = '${effect.slug.replaceAll("'", "''")}');`,
    );
  }
  for (const { effect, firework, item } of additions) {
    sql.push(
      `${insert('firework_effects', effect)}\nwhere not exists (select 1 from public.firework_effects where template_key = '${effect.template_key}' or slug = '${effect.slug}') on conflict do nothing;`,
    );
    const effectId = `(select id from public.firework_effects where template_key = '${effect.template_key}')`;
    // AFTER INSERT creates a listed catalogue item. Insert our explicit item in the
    // same statement before queued row triggers run; the trigger then hits its slug conflict.
    sql.push(`with inserted_firework as (
${insert('fireworks', firework, { firework_effect_id: effectId })}
where ${effectId} is not null and not exists (select 1 from public.fireworks where slug = '${firework.slug}')
on conflict do nothing returning id
)
${insert('catalogue_items', item, { firework_id: 'f.id' })}, inserted_firework f
on conflict do nothing;`);
    const fireworkId = `(select id from public.fireworks where slug = '${firework.slug}')`;
    sql.push(
      `${insert('catalogue_items', item, { firework_id: fireworkId })}\nwhere ${fireworkId} is not null and not exists (select 1 from public.catalogue_items where part_number = '${item.part_number}') on conflict do nothing;`,
    );
  }
  sql.push(
    'end if;',
    'end $catalogue$;',
    'drop function pg_temp.catalogue_design(jsonb, text[], text, text, bigint);',
    'commit;',
  );
  return {
    tables: {
      firework_effects: effects,
      fireworks,
      catalogue_items: items,
      firework_preview_images: previews,
    },
    migration: sql.join('\n\n') + '\n',
    report: {
      effectMappings,
      fireworks: review,
      newRowsPerTable: additions.length,
    },
  };
}

/** Writes generated artefacts, or rejects stale files without modifying them. */
export async function generateCatalogue(check = false) {
  const result = buildCatalogue();
  const outputs = new Map([[join(ROOT, MIGRATION_PATH), result.migration]]);
  const manifest = read('manifest');
  for (const [table, rows] of Object.entries(result.tables)) {
    rows.sort((left, right) => left.id.localeCompare(right.id));
    // Match the database export format, retaining existing snapshot bytes outside designs.
    const bytes = JSON.stringify(rows, null, 2) + '\n';
    outputs.set(join(BOOTSTRAP, `${table}.json`), bytes);
    manifest.tables[table] = { rows: rows.length, sha256: hash(bytes) };
  }
  outputs.set(join(BOOTSTRAP, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  outputs.set(
    join(ROOT, 'scripts/catalogue/review.json'),
    await format(JSON.stringify(result.report), { parser: 'json', printWidth: 100 }),
  );
  for (const [path, bytes] of outputs) {
    if (check) {
      if (readFileSync(path, 'utf8') !== bytes)
        throw new Error(`Stale catalogue artefact: ${path}`);
    } else writeFileSync(path, bytes);
  }
  console.log(
    `${check ? 'Checked' : 'Generated'} ${result.report.fireworks.length} existing designs and ${result.report.newRowsPerTable} library entries.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Use only --check.');
  await generateCatalogue(process.argv.includes('--check'));
}
