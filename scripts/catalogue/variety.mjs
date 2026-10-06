import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Canonicalises key ordering and optionally removes colours and stochastic identity. */
function canonical(value, omitColours = false, omitSeed = false) {
  if (Array.isArray(value)) return value.map((entry) => canonical(entry, omitColours, omitSeed));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter(
        (key) =>
          !(omitSeed && key === 'seed') &&
          !(
            omitColours &&
            ['colour', 'colours', 'trail'].includes(key) &&
            (key !== 'trail' || typeof value[key] === 'string')
          ),
      )
      .map((key) => [key, canonical(value[key], omitColours, omitSeed)]),
  );
}

/** Counts original fireworks and unordered equal pairs, excluding seeds for colour-only comparison. */
export function measureVariety(rows) {
  const designs = rows.filter((row) => !row.slug.startsWith('renderer-')).map((row) => row.design);
  const keys = (colours, seed) =>
    designs.map((design) => JSON.stringify(canonical(design, colours, seed)));
  const groups = new Map();
  for (const key of keys(true, true)) groups.set(key, (groups.get(key) ?? 0) + 1);
  return {
    fireworks: designs.length,
    distinctDesigns: new Set(keys(false, false)).size,
    distinctDesignsIgnoringSeed: new Set(keys(false, true)).size,
    identicalApartFromColourPairsIgnoringSeed: [...groups.values()].reduce(
      (sum, count) => sum + (count * (count - 1)) / 2,
      0,
    ),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  if (!paths.length) paths.push('supabase/bootstrap/fireworks.json');
  for (const path of paths)
    console.log(
      JSON.stringify({ path, ...measureVariety(JSON.parse(readFileSync(path, 'utf8'))) }),
    );
}
