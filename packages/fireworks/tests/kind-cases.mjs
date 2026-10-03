import { readFileSync } from 'node:fs';
const read = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const schema = JSON.parse(readFileSync(new URL('../schema/design.v1.json', import.meta.url)));
const defaults = (name) =>
  Object.fromEntries(
    Object.entries(schema.definitions[name].properties)
      .filter(([, p]) => 'default' in p)
      .map(([k, p]) => [k, p.default]),
  );
export const modifier = (kind) => ({ ...defaults('modifier'), kind });
export function kindCases() {
  const cases = [];
  const add = (name, design, times) => cases.push({ name, design, times });
  for (const kind of ['shell', 'mine', 'rocket']) {
    const d = read('peony');
    d.kind = kind;
    if (kind === 'rocket') d.launch.tail = 'rocket';
    const start = kind === 'mine' ? 0 : d.launch.time_s;
    add(`kind-${kind}`, d, [0.1, 0.53, start + 0.03, start + 0.45, start + 1.5, 10]);
  }
  for (const kind of ['comet', 'candle']) {
    const d = read('comet');
    d.kind = d.ground.kind = kind;
    if (kind === 'candle')
      Object.assign(d.ground.comets, { pattern: 'sequence', count: 5, spread_deg: 30 });
    add(`kind-${kind}`, d, [0, 0.53, 1.3, 2.3, 3.2, 10]);
  }
  for (const kind of ['wheel', 'spinner', 'fountain', 'tourbillon']) {
    const d = read('comet');
    d.kind = kind;
    const values = defaults(kind);
    if (kind === 'wheel' || kind === 'fountain') values.colour = '#ffe2a8';
    if (kind === 'fountain') values.direction = [0, 1, 0];
    if (kind === 'spinner') values.colours = ['#ff3048', '#2fe06a'];
    d.ground = { kind, [kind]: values };
    add(`kind-${kind}`, d, [0, 0.53, 1.3, 2.5, 4.1, 10]);
  }
  for (const pattern of [
    'ring',
    'heart',
    'spiral',
    'random',
    'bottom',
    'cone',
    'double_ring',
    'fan',
    'straight',
    'sequence',
  ]) {
    const d = read('peony');
    d.breaks[0].layers[0].pattern = pattern;
    add(`pattern-${pattern}`, d, [d.launch.time_s + 0.45, d.launch.time_s + 1.3]);
  }
  for (const look of ['palm', 'horsetail']) {
    const d = read('peony'),
      l = d.breaks[0].layers[0];
    Object.assign(
      l,
      look === 'palm'
        ? {
            pattern: 'sphere',
            count: 8,
            radius_m: 38,
            life_s: 2.8,
            drag_per_s: 0.9,
            gravity_m_s2: 12,
          }
        : {
            pattern: 'bottom',
            count: 50,
            radius_m: 24,
            life_s: 4.4,
            drag_per_s: 1.6,
            gravity_m_s2: 9,
          },
    );
    // Visible heads expose the path; the prototype horsetail look is trail-only.
    add(`look-${look}`, d, [d.launch.time_s + 0.45, d.launch.time_s + 1.3]);
  }
  for (const kind of [
    'crackle',
    'strobe',
    'twinkle',
    'crossette',
    'ghost',
    'fish',
    'bees',
    'flutter',
    'pop',
    'glitter',
    'twist',
    'split',
    'whistle',
  ]) {
    const d = read('peony'),
      l = d.breaks[0].layers[0];
    const m = modifier(kind);
    m.at = 0.35;
    if (kind === 'twist') m.angular_speed_rad_s = 1.5;
    l.modifiers = [m];
    if (kind === 'ghost')
      l.colour = {
        mode: 'solid',
        stops: [
          [0, '#ff3048'],
          [0.35, '#ff3048'],
          [0.35, '#2fe06a'],
          [1, '#2fe06a'],
        ],
      };
    add(
      `modifier-${kind}`,
      d,
      [0.45, 0.83, 1.25, 1.63, 2.25, 2.55, 2.85, 3.1].map((t) => d.launch.time_s + t),
    );
  }
  const continuous = read('peony');
  continuous.breaks[0].layers[0].modifiers = [
    { ...modifier('crackle'), at: 0.2, spread: 'continuous' },
  ];
  add(
    'crackle-continuous',
    continuous,
    [1, 1.4, 2, 2.7].map((t) => continuous.launch.time_s + t),
  );
  for (const pattern of ['fan', 'random', 'sweep', 'sequence']) {
    const d = read('comet');
    Object.assign(d.ground.comets, { pattern, count: 7, spread_deg: 60, spin_rad_s: 12 });
    add(`comet-${pattern}`, d, [0.53, 1.3, 2.4, 3.3, 6]);
  }
  for (const effect of ['pop', 'split']) {
    const d = read('comet');
    d.ground.comets[effect] = effect === 'pop' ? true : { count: 4, distance_m: 10, life_s: 0.7 };
    add(`comet-${effect}`, d, [2.21, 2.3, 2.55, 2.85]);
  }
  return cases;
}
