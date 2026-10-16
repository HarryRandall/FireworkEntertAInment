/**
 * Rebuilds every Finale-mapped catalogue product from its own VDL description, so a
 * show draws the same effects, colours, sizes, angles and timing as its exported
 * Finale 3D script. Writes a guarded content migration; run with --check in CI.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shotDuration } from '../../packages/renderer/src/index.ts';
import {
  canonicaliseEffectModelJson,
  compileFireworkDesign,
} from '../../packages/fireworks/src/design.ts';
import { previewVdlCake } from '../../apps/web/lib/finale/vdl/preview.ts';
import { vdlGlossary } from '../../apps/web/lib/finale/vdl/glossary.ts';
import { parseVdlPhrase } from '../../apps/web/lib/finale/vdl/phrase.ts';
import { buildVdlFireworks } from '../../apps/web/lib/finale/vdl/design.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BOOTSTRAP = join(ROOT, 'supabase/bootstrap');
export const VDL_MIGRATION_PATH = 'supabase/migrations/20261016000100_catalogue_vdl_products.sql';
const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.
const MM_PER_INCH = 25.4; // Inch calibers, millimetres per inch.

function read(table) {
  return JSON.parse(readFileSync(join(BOOTSTRAP, `${table}.json`), 'utf8'));
}

/** Deterministic UUID v5-style identity, so re-running the migration updates in place. */
export function id(identity) {
  const bytes = createHash('sha256').update(`showcrafter-vdl-product:${identity}`).digest();
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function literal(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

export function text(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function caliberMm(caliber) {
  const match = String(caliber ?? '').match(/^(\d+(?:\.\d+)?)\s*(mm|"|in)$/i);
  if (!match) return null;
  return match[2].toLowerCase() === 'mm' ? Number(match[1]) : Number(match[1]) * MM_PER_INCH;
}

/** The legacy engine has no exact conversion for these designs; it schedules a plain sphere. */
export function legacySnapshot() {
  const model = canonicaliseEffectModelJson({
    geometry: 'sphere',
    trailProfile: 'none',
    renderDefaults: { geometry: 'sphere' },
  });
  return JSON.parse(JSON.stringify(compileFireworkDesign({ baseModel: model })));
}

export function fireworkRow(part, index, plan, caliber, snapshot) {
  return {
    id: id(`${part}:${plan.key}`),
    slug: `vdl-${part.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    name: plan.name,
    template_key: plan.templateKey,
    design: plan.design,
    duration_seconds: Number(shotDuration(plan.design).toFixed(2)),
    height_meters: plan.heightM,
    caliber,
    render_snapshot: snapshot,
  };
}

/** Builds one rebuild entry per Finale-mapped product; throws on any unreadable line. */
export function buildVdlProducts() {
  const items = read('catalogue_items').filter((item) => item.finale_product_id);
  const fireworks = new Map(read('fireworks').map((row) => [row.id, row]));
  const shots = read('multishot_fireworks');
  const glossary = vdlGlossary();
  const snapshot = legacySnapshot();
  const products = [];
  for (const item of items.sort((a, b) => a.part_number.localeCompare(b.part_number))) {
    const description = (item.description ?? '').trim();
    if (item.catalogue_item_kind === 'multishot') {
      const caliber =
        shots
          .filter((shot) => shot.multishot_id === item.multishot_id)
          .sort((a, b) => a.sequence_index - b.sequence_index)
          .find((shot) => shot.caliber)?.caliber ?? null;
      const result = previewVdlCake(description, {
        glossary,
        existing: [],
        durationS: Number(item.duration_seconds) || null,
        caliberText: caliber,
      });
      if (result.kind !== 'preview') throw new Error(`${item.part_number}: ${result.message}`);
      const { preview } = result;
      const broken = preview.parts.find((part) => part.error);
      if (broken) throw new Error(`${item.part_number} (${broken.letter}): ${broken.error}`);
      const keys = Object.keys(preview.fireworks);
      const rows = keys.map((key, index) =>
        fireworkRow(item.part_number, index, preview.fireworks[key], caliber, snapshot),
      );
      const rowByKey = new Map(keys.map((key, index) => [key, rows[index]]));
      products.push({
        kind: 'multishot',
        part: item.part_number,
        name: item.name,
        fireworks: rows,
        shots: preview.shots.map((shot) => ({
          sequence_index: shot.sequence,
          time_offset_seconds: shot.timeMs / MILLISECONDS_PER_SECOND,
          pan_degrees: shot.angleDeg,
          timeline_track_index: shot.track,
          firework_id: rowByKey.get(shot.firework).id,
        })),
      });
      continue;
    }
    const caliber = fireworks.get(item.firework_id)?.caliber ?? null;
    const phrase = parseVdlPhrase(description, glossary);
    const built = buildVdlFireworks(phrase, {
      caliberMm: caliberMm(caliber),
      caliberText: caliber,
      encoded: null,
    });
    if (built.fireworks.length !== 1)
      throw new Error(
        `${item.part_number}: expected one firework, built ${built.fireworks.length}.`,
      );
    const [plan] = built.fireworks;
    products.push({
      kind: 'firework',
      part: item.part_number,
      name: item.name,
      design: plan.design,
      duration_seconds: Number(shotDuration(plan.design).toFixed(2)),
      height_meters: plan.heightM,
    });
  }
  return products;
}

const FUNCTIONS = `-- Replaces one cake's shots with fireworks built from its VDL, exactly as the
-- admin VDL import and composition save do, so existing triggers keep timing,
-- catalogue duration and preview images in step.
create function pg_temp.vdl_cake(p_part text, p_fireworks jsonb, p_shots jsonb)
returns void language plpgsql as $fn$
declare
  v_multishot uuid;
  v_effect uuid;
  v_caliber text;
  firework jsonb;
  before_shots jsonb;
  after_shots jsonb;
begin
  select multishot_id into v_multishot from public.catalogue_items
    where part_number = p_part and catalogue_item_kind = 'multishot' and multishot_id is not null;
  if v_multishot is null then return; end if;
  select caliber into v_caliber from public.multishot_fireworks
    where multishot_id = v_multishot and caliber is not null order by sequence_index limit 1;
  for firework in select value from jsonb_array_elements(p_fireworks) loop
    select id into v_effect from public.firework_effects where template_key = firework->>'template_key';
    if v_effect is null then
      raise exception 'No renderer template effect %.', firework->>'template_key';
    end if;
    insert into public.fireworks (id, slug, name, firework_effect_id, source, design, design_schema,
      render_overrides_json, render_snapshot_json, duration_seconds, caliber, height_meters)
    values ((firework->>'id')::uuid, firework->>'slug', firework->>'name', v_effect, 'manual',
      firework->'design', 1, firework->'render_snapshot', firework->'render_snapshot',
      (firework->>'duration_seconds')::numeric,
      coalesce(firework->>'caliber', v_caliber), (firework->>'height_meters')::numeric)
    on conflict (id) do update set name = excluded.name, firework_effect_id = excluded.firework_effect_id,
      design = excluded.design, design_schema = excluded.design_schema,
      duration_seconds = excluded.duration_seconds, caliber = excluded.caliber,
      height_meters = excluded.height_meters;
    -- Cake parts are renderer components of the cake, not separate products.
    update public.catalogue_items set is_listed = false where firework_id = (firework->>'id')::uuid;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.sequence_index), '[]') into before_shots
    from public.multishot_fireworks s where s.multishot_id = v_multishot;
  delete from public.multishot_fireworks where multishot_id = v_multishot;
  insert into public.multishot_fireworks (multishot_id, firework_id, sequence_index, timeline_track_index,
    time_offset_seconds, pan_degrees, tilt_degrees, caliber)
  select v_multishot, f.id, (shot->>'sequence_index')::integer, (shot->>'timeline_track_index')::integer,
    (shot->>'time_offset_seconds')::numeric, (shot->>'pan_degrees')::integer, 0, f.caliber
  from jsonb_array_elements(p_shots) shot
  join public.fireworks f on f.id = (shot->>'firework_id')::uuid;
  perform private.sync_multishot_derived_state(v_multishot);
  select coalesce(jsonb_agg(to_jsonb(s) order by s.sequence_index), '[]') into after_shots
    from public.multishot_fireworks s where s.multishot_id = v_multishot;
  insert into public.multishot_composition_versions (multishot_id, actor_id, before_shots, after_shots)
    values (v_multishot, null, before_shots, after_shots);
end $fn$;

-- Replaces a single-shot product's design with the one built from its VDL.
create function pg_temp.vdl_shell(p_part text, p_design jsonb, p_duration numeric, p_height numeric)
returns void language plpgsql as $fn$
begin
  update public.fireworks f set design = p_design, design_schema = 1,
    duration_seconds = p_duration, height_meters = p_height
  from public.catalogue_items item
  where item.part_number = p_part and item.catalogue_item_kind = 'firework' and f.id = item.firework_id;
end $fn$;

-- One product that an existing show or published preset cannot accept is left as
-- it was, with a notice, rather than blocking every other product.
create function pg_temp.vdl_try(p_part text, p_apply text)
returns void language plpgsql as $fn$
begin
  execute p_apply;
exception when others then
  raise notice 'Kept % unchanged: %', p_part, sqlerrm;
end $fn$;`;

/** Writes the content migration that applies {@link buildVdlProducts}. */
export async function buildVdlMigration() {
  const products = buildVdlProducts();
  const calls = products.map((product) => {
    const apply =
      product.kind === 'multishot'
        ? `select pg_temp.vdl_cake(${text(product.part)}, ${literal(product.fireworks)}, ${literal(product.shots)})`
        : `select pg_temp.vdl_shell(${text(product.part)}, ${literal(product.design)}, ${product.duration_seconds}, ${product.height_meters ?? 'null'})`;
    return `-- ${product.part} ${product.name.replace(/\s+/g, ' ')}\nselect pg_temp.vdl_try(${text(product.part)}, $apply$${apply}$apply$);`;
  });
  const sql = [
    "-- Generated by scripts/catalogue/vdl-products.mjs from each product's Finale VDL description.",
    'begin;',
    FUNCTIONS,
    // Products absent from a database (an empty bootstrap, say) are skipped by part number.
    ...calls,
    'commit;',
    '',
  ].join('\n\n');
  return { products, sql };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { products, sql } = await buildVdlMigration();
  const path = join(ROOT, VDL_MIGRATION_PATH);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== sql) {
      console.error(`${VDL_MIGRATION_PATH} is stale. Run pnpm catalogue:vdl.`);
      process.exit(1);
    }
  } else {
    writeFileSync(path, sql);
  }
  const shots = products.reduce((sum, product) => sum + (product.shots?.length ?? 0), 0);
  console.log(`${products.length} products, ${shots} cake shots.`);
}
