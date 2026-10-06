import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { readSnapshot, snapshotSql } from '../database/bootstrap-content.mjs';
import { executeSql, query, repositoryRoot } from '../database/runtime.mjs';
import { effectTemplates, upgradeDesign } from '../../packages/renderer/src/index.ts';
import { catalogueDesign } from './designs.mjs';
import { buildCatalogue, MIGRATION_PATH } from './generate.mjs';

const LOCAL_TARGET = { local: true, flags: ['--local'] };
const TABLES = ['firework_effects', 'fireworks', 'catalogue_items', 'firework_preview_images'];

function digest() {
  return query(
    LOCAL_TARGET,
    `select ${TABLES.map((table) => `(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.${table} t) as ${table}`).join(', ')}`,
  )[0];
}

/** Checks PostgreSQL and package validation for every installed effect and firework. */
export function verifyInstalledDesigns() {
  for (const table of ['firework_effects', 'fireworks']) {
    const rows = query(
      LOCAL_TARGET,
      `select slug, design, design_schema from public.${table} order by slug`,
    );
    assert.equal(rows.length, table === 'firework_effects' ? 102 : 166);
    for (const row of rows)
      assert.deepEqual(upgradeDesign(row.design, row.design_schema), row.design);
  }
  assert.equal(
    query(
      LOCAL_TARGET,
      "select count(*)::int as count from public.catalogue_items where part_number like 'renderer-%' and not is_listed",
    )[0].count,
    76,
  );
  assert.equal(
    query(LOCAL_TARGET, 'select count(*)::int as count from public.firework_preview_images')[0]
      .count,
    307,
  );
  console.log(
    'Valid designs: 102 effects, 166 fireworks; 76 unlisted library items; 307 preview manifests.',
  );
}

function verifyPrevious(directory) {
  const previous = readSnapshot(resolve(directory));
  assert.equal(previous.tables.fireworks.length, 90);
  assert.ok(previous.tables.fireworks.every((row) => row.design === null));
  executeSql(LOCAL_TARGET, snapshotSql(previous));
  const migration = readFileSync(join(repositoryRoot, MIGRATION_PATH), 'utf8');
  // All integration probes are rolled back, leaving the exact previous content for the real replay.
  const firework = previous.tables.fireworks.find((row) => row.slug === 'peony-crimson');
  const effect = previous.tables.firework_effects.find(
    (row) => row.id === firework.firework_effect_id,
  );
  const customDesign = JSON.parse(
    readFileSync(join(repositoryRoot, 'supabase/bootstrap/fireworks.json')),
  ).find((row) => row.slug === 'peony-default').design;
  customDesign.seed = 123456;
  const liveFirework = {
    ...firework,
    id: 'feeeeeee-0000-4000-8000-000000000001',
    firework_effect_id: 'feeeeeee-0000-4000-8000-000000000002',
    primary_color: '#abcdef',
    color_palette: ['#abcdef', '#123456'],
    height_meters: 100,
  };
  const matchedKey = buildCatalogue().report.fireworks.find(
    (row) => row.slug === liveFirework.slug,
  ).templateKey;
  const expectedLiveDesign = catalogueDesign(
    effectTemplates.find((template) => template.key === matchedKey).design,
    liveFirework,
  );
  const liveEffect = { ...effect, id: liveFirework.firework_effect_id };
  const json = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const body = migration.replace(/^begin;$/m, '').replace(/^commit;$/m, '');
  executeSql(
    LOCAL_TARGET,
    `begin;
    update public.firework_effects set slug = 'verify-original-effect' where slug = '${effect.slug}';
    update public.fireworks set slug = 'verify-original-firework' where slug = '${firework.slug}';
    insert into public.firework_effects select * from jsonb_populate_record(null::public.firework_effects, ${json(liveEffect)});
    insert into public.fireworks select * from jsonb_populate_record(null::public.fireworks, ${json(liveFirework)});
    update public.fireworks set design = ${json(customDesign)} where slug = 'peony-default';
    update public.firework_effects set template_key = 'owner-custom' where slug = 'brocade';
    ${body}
    do $probe$ begin
      if (select design from public.fireworks where slug = 'peony-default') <> ${json(customDesign)} then raise exception 'Admin design changed'; end if;
      if (select template_key from public.firework_effects where slug = 'brocade') <> 'owner-custom' then raise exception 'Admin template key changed'; end if;
      if (select design #>> '{launch,height_m}' from public.fireworks where slug = '${firework.slug}')::numeric <> 60 then raise exception 'Band apex or slug remapping failed'; end if;
      if (select design from public.fireworks where slug = '${firework.slug}') <> ${json(expectedLiveDesign)} then raise exception 'Live palette or template structure failed'; end if;
    end $probe$;
    rollback;`,
  );
  executeSql(LOCAL_TARGET, migration);
  verifyInstalledDesigns();
  // Conversion must leave old-renderer evidence and product specifications intact.
  const sourceColumns = [
    'slug',
    'render_snapshot_json',
    'render_overrides_json',
    'primary_color',
    'secondary_color',
    'color_palette',
    'caliber',
    'duration_seconds',
    'height_meters',
  ];
  for (const { source: row } of query(
    LOCAL_TARGET,
    `select to_jsonb(source) as source from (select ${sourceColumns.join(', ')} from public.fireworks where slug not like 'renderer-%') source`,
  )) {
    const original = previous.tables.fireworks.find((candidate) => candidate.slug === row.slug);
    assert.deepEqual(
      row,
      Object.fromEntries(sourceColumns.map((column) => [column, original[column]])),
    );
  }
  const before = digest();
  executeSql(LOCAL_TARGET, migration);
  assert.deepEqual(digest(), before);
  const generated = readSnapshot(join(repositoryRoot, 'supabase/bootstrap'));
  for (const table of ['firework_effects', 'fireworks']) {
    for (const row of query(LOCAL_TARGET, `select slug, design from public.${table}`)) {
      const expected = generated.tables[table].find(
        (candidate) => candidate.slug === row.slug,
      ).design;
      // PostgreSQL sqrt and JavaScript pow can differ at the final floating-point bit.
      if (row.design.kind === 'shell') {
        assert.ok(Math.abs(row.design.launch.time_s - expected.launch.time_s) < 1e-12);
        row.design.launch.time_s = expected.launch.time_s;
      }
      assert.deepEqual(row.design, expected);
    }
  }
  console.log(
    'Previous bootstrap migration passed twice with identical full-table hashes. Old snapshots/specifications, admin designs, template keys, live colours/heights and different UUIDs passed.',
  );
}

if (process.argv.length === 2) verifyInstalledDesigns();
else if (process.argv.length === 4 && process.argv[2] === '--previous-bootstrap')
  verifyPrevious(process.argv[3]);
else throw new Error('Use no arguments, or --previous-bootstrap <directory> after a local reset.');
