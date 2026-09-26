import { isDeepStrictEqual } from 'node:util';
import {
  convertEmissionDesign,
  convertEmissionPart,
  convertEmissionHistory,
} from './convert-emission-settings.mjs';

const definitions = [
  ['firework_effects', { model_json: convertEmissionDesign }],
  ['fireworks', { render_snapshot_json: convertEmissionDesign }],
  ['firework_style_defaults', { defaults_json: convertEmissionPart }],
  [
    'firework_editor_versions',
    { snapshot_json: convertEmissionHistory, previous_snapshot_json: convertEmissionHistory },
  ],
];
export const emissionTables = definitions.map(([table]) => table);

// One SELECT gives all tables the same MVCC snapshot. Read everything so the
// later guard notices edits to identity, scheduling and history as well as JSON.
export const emissionSnapshotQuery = definitions
  .map(
    ([table]) =>
      `select '${table}' as table_name, coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb) as rows from public.${table} t`,
  )
  .join('\nunion all\n');

export function planEmissionBackfill(snapshot) {
  const updates = [];
  const invalid = [];
  for (const [table, fields] of definitions) {
    const rows = snapshot[table];
    if (!Array.isArray(rows)) throw new Error(`Missing conversion table: ${table}.`);
    for (const row of rows) {
      if (typeof row.id !== 'string' || !/^[\da-f-]{36}$/i.test(row.id))
        throw new Error('Invalid record ID.');
      const patch = {};
      for (const [field, convert] of Object.entries(fields)) {
        try {
          const value = convert(row[field]);
          if (!isDeepStrictEqual(value, row[field])) patch[field] = value;
        } catch (error) {
          invalid.push({ table, id: row.id, field, error: error.message });
        }
      }
      if (Object.keys(patch).length) updates.push({ table, id: row.id, patch });
    }
  }
  return { originals: structuredClone(snapshot), updates, invalid };
}

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

export function emissionBackfillStatements(plan, schema = 'public') {
  if (!['public', 'pg_temp'].includes(schema)) throw new Error('Unsupported conversion schema.');
  if (plan.invalid.length) throw new Error('Resolve every conversion diagnostic before applying.');
  // Recalculate rather than trust a caller-provided patch or table/column name.
  const checked = planEmissionBackfill(plan.originals);
  if (!isDeepStrictEqual(checked, plan)) throw new Error('The conversion plan has changed.');
  const checks = definitions.map(
    ([table]) => `
    if (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb) from ${schema}.${table} t)
       is distinct from ${literal(JSON.stringify(plan.originals[table]))}::jsonb then
      raise exception 'Catalogue changed during emission conversion: ${table}';
    end if;`,
  );
  const writes = plan.updates.map(({ table, id, patch }) => {
    const sets = Object.entries(patch).map(
      ([field, value]) => `${field} = ${literal(JSON.stringify(value))}::jsonb`,
    );
    if (table !== 'firework_editor_versions') sets.push('updated_at = clock_timestamp()');
    return `update ${schema}.${table} set ${sets.join(', ')} where id = ${literal(id)}::uuid;
    if not found then raise exception 'Missing conversion record'; end if;`;
  });
  return `set local standard_conforming_strings = on;
set local lock_timeout = '5s';
lock table ${emissionTables.map((table) => `${schema}.${table}`).join(', ')} in share row exclusive mode;
do ${literal(`begin\n${checks.join('\n')}\n${writes.join('\n')}\nend`)};`;
}
