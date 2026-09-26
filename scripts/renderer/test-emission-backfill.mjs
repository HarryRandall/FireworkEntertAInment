import './register-typescript.mjs';
import { executeSql } from '../database/runtime.mjs';
import {
  emissionTables,
  planEmissionBackfill,
  emissionBackfillStatements,
} from './emission-backfill-plan.mjs';

const id = '00000000-0000-0000-0000-000000000001';
const original = {
  geometry: 'ring',
  stars: { outer: { count: 60 } },
  note: "O'Brien $emission_conversion$ \\ text",
};
const snapshot = {
  firework_effects: [{ id, updated_at: 'before', model_json: original }],
  fireworks: [{ id, updated_at: 'before', render_snapshot_json: original }],
  firework_style_defaults: [
    { id, updated_at: 'before', defaults_json: { stars: { outer: { count: 60 } } } },
  ],
  firework_editor_versions: [
    { id, snapshot_json: { kind: 'effect', modelJson: original }, previous_snapshot_json: null },
  ],
};
const fields = {
  firework_effects: 'model_json',
  fireworks: 'render_snapshot_json',
  firework_style_defaults: 'defaults_json',
  firework_editor_versions: 'snapshot_json',
};
const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;
const plan = planEmissionBackfill(snapshot);
const conversion = emissionBackfillStatements(plan, 'pg_temp');
const setup = `begin; set local standard_conforming_strings = on;
${emissionTables
  .map(
    (
      table,
    ) => `create temporary table ${table} (id uuid primary key, ${table === 'firework_editor_versions' ? 'previous_snapshot_json jsonb,' : 'updated_at text,'} ${fields[table]} jsonb) on commit drop;
insert into pg_temp.${table} select * from jsonb_populate_recordset(null::pg_temp.${table}, ${quote(JSON.stringify(snapshot[table]))}::jsonb);`,
  )
  .join('\n')}`;
const assertOriginal = `do $test$ begin
  if (select model_json from pg_temp.firework_effects) is distinct from ${quote(JSON.stringify(original))}::jsonb
     or (select updated_at from pg_temp.firework_effects) <> 'before' then
    raise exception 'Partial conversion was not rolled back';
  end if;
end $test$;`;

executeSql(
  { local: true },
  `${setup}
${conversion}
do $test$ begin
  if (select model_json #>> '{stars,outer,count}' from pg_temp.firework_effects) <> '43' then raise exception 'Count was not converted'; end if;
  if (select render_snapshot_json #>> '{stars,outer,emissionRate}' from pg_temp.fireworks) <> '84' then raise exception 'Snapshot rate was not converted'; end if;
  if (select updated_at from pg_temp.fireworks) = 'before' then raise exception 'Stale drafts were not invalidated'; end if;
  if (select snapshot_json #>> '{modelJson,stars,outer,count}' from pg_temp.firework_editor_versions) <> '43' then raise exception 'History was not converted'; end if;
end $test$;
rollback;`,
);
console.log('PASS conversion, history, revision advance and quoted JSON');

executeSql(
  { local: true },
  `${setup}
update pg_temp.fireworks set updated_at = 'concurrent edit';
do $test$ begin
  begin
    execute ${quote(conversion)};
    raise exception 'Expected stale conversion rejection';
  exception when raise_exception then
    if sqlerrm <> 'Catalogue changed during emission conversion: fireworks' then raise; end if;
  end;
end $test$;
${assertOriginal}
rollback;`,
);
console.log('PASS concurrent edit rejects the whole conversion');

executeSql(
  { local: true },
  `${setup}
alter table pg_temp.fireworks add constraint simulated_save_failure check (render_snapshot_json #> '{stars,outer,emissionRate}' is null);
do $test$ begin
  begin
    execute ${quote(conversion)};
    raise exception 'Expected conversion write failure';
  exception when check_violation then null;
  end;
end $test$;
${assertOriginal}
rollback;`,
);
console.log('PASS later write failure rolls back earlier records');
