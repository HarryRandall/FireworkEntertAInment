/** Small authored cases shared by the independent capture and spray parity tests. */
import { readFileSync } from 'node:fs';
import { kindCases } from './kind-cases.mjs';
/** Returns fresh designs and evaluation times in seconds covering spray and smoke controls. */
export function sprayCases() {
  const cases = kindCases().filter(
    (c) =>
      c.name.startsWith('kind-') ||
      c.name.startsWith('comet-') ||
      [
        'modifier-strobe',
        'modifier-twinkle',
        'modifier-glitter',
        'modifier-crossette',
        'modifier-crackle',
        'modifier-ghost',
        'modifier-fish',
        'modifier-bees',
        'modifier-flutter',
        'modifier-twist',
      ].includes(c.name),
  );
  const peony = () => JSON.parse(readFileSync(new URL('./fixtures/peony.json', import.meta.url)));
  for (const tail of [
    'gold',
    'silver',
    'glitter',
    'comet',
    'crackle',
    'whistle',
    'heli',
    'rocket',
    'tiger',
    'willow',
    'strobe',
    'brocade',
    'dark',
    'flowers',
  ]) {
    const d = peony();
    d.launch.tail = tail;
    d.launch.tilt_deg = 14;
    cases.push({
      name: `spray-launch-${tail}`,
      design: d,
      times: [0.1, 0.53, 1.3, d.launch.time_s + 0.45, 4, 7],
    });
  }
  const trail = peony();
  Object.assign(trail.breaks[0].layers[0].trail, {
    sparks: 35,
    fork: 0.7,
    glitter: 0.5,
    glitter_delay_s: 0.6,
    colour: 'star',
  });
  trail.breaks[0].layers[0].head.visible = false;
  cases.push({ name: 'fork-glitter-hidden-head', design: trail, times: [2.1, 2.5, 3.1, 4.5] });
  const fountain = structuredClone(cases.find((c) => c.name === 'kind-fountain').design);
  Object.assign(fountain.ground.fountain, {
    emitters: 4,
    direction: [0, -1, 0],
    height_m: 8,
    streak: 4,
    fork: 0.3,
    glitter: 0.4,
  });
  cases.push({ name: 'fountain-line', design: fountain, times: [0.53, 2.5, 7.5, 9] });
  const multi = JSON.parse(readFileSync(new URL('./fixtures/multi-break.json', import.meta.url)));
  // The prototype allows one modifier per layer. Composition is tested separately.
  multi.breaks[0].layers[0].modifiers = multi.breaks[0].layers[0].modifiers.slice(0, 1);
  cases.push({ name: 'multi-break-smoke', design: multi, times: [2.5, 3.1, 4.2, 6] });
  const flare = peony();
  flare.breaks[0].layers[0].head.size = 3;
  cases.push({ name: 'flare-smoke', design: flare, times: [2.5, 3.1] });
  return cases;
}
