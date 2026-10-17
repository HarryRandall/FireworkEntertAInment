/**
 * Bulk-imports catalogue products from a CSV of Finale VDL descriptions. Every row is built
 * with the calibrated VDL converter (the same one that rebuilt the Finale-mapped catalogue),
 * validated strictly, and written as a guarded content migration.
 *
 * Usage: pnpm catalogue:import <products.csv> <migration-file-name> [--check]
 *
 * CSV columns (header row required):
 *   part_number  unique part number, also the multishot or firework slug
 *   name         catalogue name
 *   kind         cake, or the single-device family: shell, mine, comet
 *   caliber      such as 30mm or 1.75"; used when the VDL line has none
 *   duration_seconds  a cake's first-to-last launch time (spreads untimed rows)
 *   vdl          Finale VDL description
 *   manufacturer catalogue manufacturer label
 *   finale_product_id  optional Finale product link
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shotDuration } from '../../packages/renderer/src/index.ts';
import { previewVdlCake } from '../../apps/web/lib/finale/vdl/preview.ts';
import { vdlGlossary } from '../../apps/web/lib/finale/vdl/glossary.ts';
import { parseVdlPhrase } from '../../apps/web/lib/finale/vdl/phrase.ts';
import { buildVdlFireworks } from '../../apps/web/lib/finale/vdl/design.ts';
import { readCsv } from '../../apps/web/lib/finale/csv.ts';
import { caliberMm, fireworkRow, id, legacySnapshot, literal, text } from './vdl-products.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.
const COLUMNS = [
  'part_number',
  'name',
  'kind',
  'caliber',
  'duration_seconds',
  'vdl',
  'manufacturer',
  'finale_product_id',
];
const SINGLE_KINDS = new Set(['shell', 'mine', 'comet']);

/** Reads and validates the product CSV into typed rows; throws listing every bad row. */
export function readProducts(csvText) {
  const [header, ...rows] = readCsv(csvText.replace(/^﻿/, '')).filter((row) =>
    row.some((cell) => cell.trim() !== ''),
  );
  const index = Object.fromEntries(COLUMNS.map((column) => [column, header.indexOf(column)]));
  const missing = COLUMNS.filter((column) => column !== 'finale_product_id' && index[column] < 0);
  if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(', ')}.`);
  const seen = new Set();
  return rows.map((row, line) => {
    const cell = (column) => (index[column] < 0 ? '' : (row[index[column]] ?? '').trim());
    const product = {
      part: cell('part_number'),
      name: cell('name'),
      kind: cell('kind').toLowerCase(),
      caliber: cell('caliber') || null,
      durationS: Number(cell('duration_seconds')) || null,
      vdl: cell('vdl'),
      manufacturer: cell('manufacturer') || null,
      finaleProductId: cell('finale_product_id') || null,
    };
    const where = `Row ${line + 2} (${product.part || 'no part number'})`;
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/.test(product.part))
      throw new Error(
        `${where}: part numbers use letters, digits, space, dot, dash or underscore.`,
      );
    if (seen.has(product.part)) throw new Error(`${where}: duplicate part number.`);
    seen.add(product.part);
    if (!product.name || product.name.length > 180) throw new Error(`${where}: name is required.`);
    if (product.kind !== 'cake' && !SINGLE_KINDS.has(product.kind))
      throw new Error(`${where}: kind must be cake, shell, mine or comet.`);
    if (!product.vdl) throw new Error(`${where}: VDL description is required.`);
    return { ...product, where };
  });
}

/** Builds each product with the converter, refusing errors and unknown words. */
export function buildImport(products) {
  const glossary = vdlGlossary();
  const snapshot = legacySnapshot();
  return products.map((product) => {
    if (product.kind === 'cake') {
      const result = previewVdlCake(product.vdl, {
        glossary,
        existing: [],
        durationS: product.durationS,
        caliberText: product.caliber,
      });
      if (result.kind !== 'preview') throw new Error(`${product.where}: ${result.message}`);
      const { preview } = result;
      for (const part of preview.parts) {
        if (part.error) throw new Error(`${product.where} (${part.letter}): ${part.error}`);
        if (part.unknownWords.length)
          throw new Error(
            `${product.where} (${part.letter}): unknown words ${part.unknownWords.join(', ')}.`,
          );
      }
      const keys = Object.keys(preview.fireworks);
      const rows = keys.map((key, index) =>
        fireworkRow(product.part, index, preview.fireworks[key], product.caliber, snapshot),
      );
      const rowByKey = new Map(keys.map((key, index) => [key, rows[index]]));
      return {
        ...product,
        lastShotS: preview.lastShotS,
        fireworks: rows,
        shots: preview.shots.map((shot) => ({
          sequence_index: shot.sequence,
          time_offset_seconds: shot.timeMs / MILLISECONDS_PER_SECOND,
          pan_degrees: shot.angleDeg,
          timeline_track_index: shot.track,
          firework_id: rowByKey.get(shot.firework).id,
        })),
      };
    }
    const phrase = parseVdlPhrase(product.vdl, glossary);
    if (phrase.unknownWords.length)
      throw new Error(`${product.where}: unknown words ${phrase.unknownWords.join(', ')}.`);
    const built = buildVdlFireworks(phrase, {
      caliberMm: caliberMm(product.caliber),
      caliberText: product.caliber,
      encoded: null,
    });
    if (built.fireworks.length !== 1)
      throw new Error(
        `${product.where}: a single device must build one firework, not ${built.fireworks.length}.`,
      );
    const [plan] = built.fireworks;
    if (plan.family !== product.kind)
      throw new Error(
        `${product.where}: the VDL describes a ${plan.family}, not a ${product.kind}.`,
      );
    return {
      ...product,
      firework: {
        id: id(`import:${product.part}`),
        name: product.name,
        template_key: plan.templateKey,
        design: plan.design,
        duration_seconds: Number(shotDuration(plan.design).toFixed(2)),
        height_meters: plan.heightM,
        caliber: product.caliber,
        render_snapshot: snapshot,
      },
    };
  });
}

const FUNCTIONS = `-- Creates (or refreshes) one cake: its multishot, the fireworks its VDL describes and
-- their shots. The multishot trigger creates the catalogue item; existing triggers keep
-- timing, catalogue duration and preview images in step, as in the admin VDL import.
create function pg_temp.import_cake(p_part text, p_name text, p_vdl text, p_duration numeric,
  p_fireworks jsonb, p_shots jsonb)
returns uuid language plpgsql as $fn$
declare
  v_multishot uuid;
  v_effect uuid;
  firework jsonb;
  before_shots jsonb;
  after_shots jsonb;
begin
  select id into v_multishot from public.multishots where slug = p_part;
  if v_multishot is null then
    insert into public.multishots (slug, name, description, duration_seconds)
      values (p_part, p_name, p_vdl, p_duration) returning id into v_multishot;
  end if;
  for firework in select value from jsonb_array_elements(p_fireworks) loop
    select id into v_effect from public.firework_effects where template_key = firework->>'template_key';
    if v_effect is null then
      raise exception 'No renderer template effect %.', firework->>'template_key';
    end if;
    insert into public.fireworks (id, slug, name, firework_effect_id, source, design, design_schema,
      render_overrides_json, render_snapshot_json, duration_seconds, caliber, height_meters)
    values ((firework->>'id')::uuid, firework->>'slug', firework->>'name', v_effect, 'manual',
      firework->'design', 1, firework->'render_snapshot', firework->'render_snapshot',
      (firework->>'duration_seconds')::numeric, firework->>'caliber', (firework->>'height_meters')::numeric)
    on conflict (id) do update set name = excluded.name, firework_effect_id = excluded.firework_effect_id,
      design = excluded.design, duration_seconds = excluded.duration_seconds,
      caliber = excluded.caliber, height_meters = excluded.height_meters;
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
  return v_multishot;
end $fn$;

-- Creates (or refreshes) one single-device firework; its trigger creates the catalogue item.
create function pg_temp.import_single(p_part text, p_firework jsonb)
returns void language plpgsql as $fn$
declare
  v_effect uuid;
begin
  select id into v_effect from public.firework_effects where template_key = p_firework->>'template_key';
  if v_effect is null then
    raise exception 'No renderer template effect %.', p_firework->>'template_key';
  end if;
  insert into public.fireworks (id, slug, name, firework_effect_id, source, design, design_schema,
    render_overrides_json, render_snapshot_json, duration_seconds, caliber, height_meters)
  values ((p_firework->>'id')::uuid, p_part, p_firework->>'name', v_effect, 'manual',
    p_firework->'design', 1, p_firework->'render_snapshot', p_firework->'render_snapshot',
    (p_firework->>'duration_seconds')::numeric, p_firework->>'caliber', (p_firework->>'height_meters')::numeric)
  on conflict (id) do update set name = excluded.name, firework_effect_id = excluded.firework_effect_id,
    design = excluded.design, duration_seconds = excluded.duration_seconds,
    caliber = excluded.caliber, height_meters = excluded.height_meters;
end $fn$;

-- Describes the catalogue product the triggers created, and lists it.
create function pg_temp.describe_product(p_part text, p_name text, p_vdl text, p_type text,
  p_duration numeric, p_manufacturer text, p_finale_product_id text)
returns void language plpgsql as $fn$
begin
  update public.catalogue_items set name = p_name, description = p_vdl, firework_type = p_type,
    duration_seconds = coalesce(p_duration, duration_seconds), manufacturer = p_manufacturer,
    finale_product_id = p_finale_product_id, is_listed = true,
    metadata = metadata || jsonb_build_object('import', 'vdl')
  where part_number = p_part;
end $fn$;`;

/** Builds the migration SQL that creates every product in the file. */
export function importMigration(products, source) {
  const calls = products.map((product) => {
    const head = `-- ${product.part} ${product.name}`;
    const describe = `perform pg_temp.describe_product(${text(product.part)}, ${text(product.name)}, ${text(product.vdl)}, ${text(product.kind === 'cake' ? 'Cake' : product.kind)}, ${product.kind === 'cake' ? (product.durationS ?? product.lastShotS) : 'null'}, ${product.manufacturer ? text(product.manufacturer) : 'null'}, ${product.finaleProductId ? text(product.finaleProductId) : 'null'});`;
    const create =
      product.kind === 'cake'
        ? `perform pg_temp.import_cake(${text(product.part)}, ${text(product.name)}, ${text(product.vdl)}, ${product.durationS ?? product.lastShotS}, ${literal(product.fireworks)}, ${literal(product.shots)});`
        : `perform pg_temp.import_single(${text(product.part)}, ${literal(product.firework)});`;
    return `${head}\n${create}\n${describe}`;
  });
  return [
    `-- Generated by scripts/catalogue/import-vdl.mjs from ${source}. Edit the CSV and regenerate.`,
    'begin;',
    FUNCTIONS,
    // Empty databases (fresh installs, CI) receive catalogue content from bootstrap after
    // migrations run, so there are no renderer templates to build on yet; skip, as the
    // catalogue design migration does.
    [
      'do $import$ begin',
      'if not exists (select 1 from public.firework_effects where template_key is not null) then',
      "  raise notice 'No renderer template effects yet; skipping the product import.';",
      '  return;',
      'end if;',
      ...calls,
      'end $import$;',
    ].join('\n'),
    'commit;',
    '',
  ].join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [csvPath, migrationName] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (!csvPath || !migrationName)
    throw new Error('Usage: pnpm catalogue:import <products.csv> <migration-file-name> [--check]');
  const products = buildImport(readProducts(readFileSync(resolve(csvPath), 'utf8')));
  const sql = importMigration(products, csvPath.replace(`${ROOT}`, ''));
  const target = join(ROOT, 'supabase/migrations', migrationName);
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== sql) {
      console.error(`${migrationName} is stale. Regenerate it from ${csvPath}.`);
      process.exit(1);
    }
  } else writeFileSync(target, sql);
  const cakes = products.filter((product) => product.kind === 'cake');
  const shots = cakes.reduce((sum, cake) => sum + cake.shots.length, 0);
  console.log(`${cakes.length} cakes (${shots} shots), ${products.length - cakes.length} singles.`);
}
