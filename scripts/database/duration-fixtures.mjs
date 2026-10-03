// Generate SQL duration checks from the shared renderer without changing its implementation.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { shotDuration } from '../../packages/fireworks/src/sim/timing.ts';
import { designSchema } from '../../packages/fireworks/src/schema/design.generated.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const arguments_ = process.argv.slice(2);
if (arguments_.length > 1 || (arguments_.length === 1 && arguments_[0] !== '--check')) {
  throw new Error('Use db:duration-fixtures or db:duration-fixtures --check.');
}
const check = arguments_[0] === '--check';
// The stored adjustment format permits strength levels from -3 to +3, including zero.
const adjustmentLevels = [-3, -1, 0, 1, 3];
// Duration is stored in integer milliseconds from firing, rounded upwards for safe planning.
const millisecondsPerSecond = 1000;
// One integer-millisecond quantum covers differing IEEE-754 and decimal ceiling at an exact boundary.
const durationToleranceMs = 1;
const directory = join(root, 'packages/fireworks/src/templates');
const examples = readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({
    name: name.slice(0, -'.json'.length),
    design: designSchema.parse(JSON.parse(readFileSync(join(directory, name), 'utf8')).design),
  }));
const peony = examples.find((example) => example.name === 'peony');
if (!peony) throw new Error('The peony duration fixture is missing.');
const controls = ['launch.height', 'launch.climb'];
for (const layer of peony.design.breaks[0].layers) {
  controls.push(`layer.${layer.id}.burn`, `layer.${layer.id}.trail.length`);
}
for (const key of controls)
  for (const level of adjustmentLevels) {
    examples.push({
      name: `${key} level ${level}`,
      design: { ...peony.design, adjustments: { [key]: level } },
    });
  }

for (const example of [...examples].filter(({ name }) =>
  ['comet', 'romanCandle', 'tourbillon', 'fountain'].includes(name),
)) {
  const keys =
    example.design.kind === 'fountain'
      ? ['ground.duration']
      : ['ground.height', 'ground.climb', 'ground.count'];
  for (const key of keys)
    for (const level of adjustmentLevels) {
      examples.push({
        name: `${example.name} ${key} level ${level}`,
        design: { ...example.design, adjustments: { [key]: level } },
      });
    }
}
// JSONB stores shorter keys first. Check the same order at the climb-time upper bound.
const clamped = structuredClone(peony.design);
clamped.launch.time_s = 120;
clamped.adjustments = { 'launch.climb': -3, 'launch.height': -3 };
examples.push({ name: 'clamped stored climb controls', design: clamped });

const assertions = examples.map(({ name, design }) => {
  const durationMs = Math.ceil(shotDuration(design) * millisecondsPerSecond);
  const document = JSON.stringify(design);
  const label = name.replaceAll("'", "''");
  return `select cmp_ok(abs((private.effect_facts($document$${document}$document$::jsonb)->>'duration_ms')::int - ${durationMs}), '<=', ${durationToleranceMs}, '${label} duration agrees within one millisecond');`;
});
const sql = [
  '-- Generated from renderer templates and shotDuration; use pnpm db:duration-fixtures to refresh.',
  'select no_plan();',
  ...assertions,
  'select * from finish();',
  '',
].join('\n');
const path = join(root, 'supabase/tests/33_catalogue_duration.sql');
if (check) {
  if (readFileSync(path, 'utf8') !== sql)
    throw new Error('Database duration fixtures have drifted from the renderer.');
} else writeFileSync(path, sql);
console.log(`${examples.length} renderer duration examples ${check ? 'match' : 'generated'}.`);
