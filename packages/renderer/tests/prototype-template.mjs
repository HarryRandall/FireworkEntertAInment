/** Restore only original height/time inputs for unchanged independent prototype goldens. */
import { readFileSync } from 'node:fs';
const heights = JSON.parse(
  readFileSync(new URL('./fixtures/prototype-template-heights.json', import.meta.url)),
);
export function prototypeTemplate(entry) {
  const design = structuredClone(entry.design);
  const original = heights[entry.key];
  if (original) Object.assign(design.launch ?? design.ground.comets, original);
  return design;
}
