import { query, executeSql, databaseTarget } from '../database/runtime.mjs';
import { validateFireworkDesign } from '../../packages/fireworks/src/design.ts';

const apply = process.argv.includes('--apply');
const target = databaseTarget(process.argv.slice(2).filter((arg) => arg !== '--apply'));
const rows = query(
  target,
  `select f.id::text as id, f.updated_at::text as updated_at, f.primary_color, f.color_palette,
  f.render_overrides_json, e.model_json from public.fireworks f
  join public.firework_effects e on e.id = f.firework_effect_id
  where f.render_snapshot_json is null order by f.id`,
);
const converted = [];
const invalid = [];
for (const row of rows) {
  const result = validateFireworkDesign({
    baseModel: row.model_json,
    variantOverrides: row.render_overrides_json,
    primaryColor: row.primary_color,
    colorPalette: row.color_palette,
  });
  if (result.ok) converted.push({ ...row, snapshot: result.design });
  else invalid.push({ id: row.id, diagnostics: result.diagnostics });
}
console.log(
  JSON.stringify(
    { mode: apply ? 'apply' : 'preview', pending: rows.length, valid: converted.length, invalid },
    null,
    2,
  ),
);
if (invalid.length)
  throw new Error('Backfill stopped. Fix every invalid record before switching readers.');
if (apply && converted.length) {
  const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
  // A single transaction retains original settings and rejects concurrent changes.
  const statements = converted
    .map(
      (
        row,
      ) => `update public.fireworks set render_snapshot_json = ${literal(JSON.stringify(row.snapshot))}::jsonb
    where id = ${literal(row.id)}::uuid and updated_at = ${literal(row.updated_at)}::timestamptz and render_snapshot_json is null;
    if not found then raise exception 'Firework changed during backfill'; end if;`,
    )
    .join('\n');
  executeSql(target, `begin; do $backfill$ begin ${statements} end $backfill$; commit;`);
  console.log(`Saved ${converted.length} resolved snapshots. Original settings are retained.`);
}
