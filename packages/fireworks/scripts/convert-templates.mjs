/** One-off prototype preset conversion into stored designs and a typed catalogue. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadReference } from './template-reference.mjs';
import { upgradeDesign } from '../src/schema/index.ts';

const path = process.argv[2];
if (!path) throw new Error('Pass the absolute path to the read-only reference fireworks3d.js');
const ref = loadReference(path);
const schema = JSON.parse(
  readFileSync(new URL('../schema/design.v1.json', import.meta.url), 'utf8'),
);
const output = new URL('../src/templates/', import.meta.url);
// Stored defaults were audited against prototype runtime fallbacks; validation never fills them.
const defaults = (name) =>
  Object.fromEntries(
    Object.entries(schema.definitions[name].properties)
      .filter(([, value]) => 'default' in value)
      .map(([key, value]) => [key, structuredClone(value.default)]),
  );
// Normalised-life colour blend widths and shell reignition tuning from fillShot/fillComets.
const SHELL_BLEND = 0.08;
const COMET_BLEND = 0.1;
const REIGNITION_DURATION = 0.1;
const REIGNITION_AMOUNT = 0.5;
// Prototype comet change point as a fraction of climb time, and sweep spacing in seconds.
const COMET_CHANGE_AT = 0.55;
const SWEEP_GAP_S = 0.08;
// Default playback seed used by the prototype's single-effect viewers.
const TEMPLATE_SEED = 11;
// Metres above ground: fillFountain uses a higher glow than its spark emitter when height is absent.
const FOUNTAIN_GLOW_HEIGHT_M = 1.2;

function mapped(name, value, aliases = {}) {
  const result = defaults(name);
  for (const [key, v] of Object.entries(value)) {
    const target = aliases[key] ?? key;
    if (!(target in schema.definitions[name].properties))
      throw new Error(`Unmapped ${name}.${key}`);
    result[target] = v;
  }
  return result;
}
function colour(palette, mode, target, at, ghost = false, comet = false) {
  const stops = [[0, palette]];
  if (target) {
    const end = ghost ? at : at + (comet ? COMET_BLEND : SHELL_BLEND);
    stops.push([at, palette], [end, target]);
    if (end < 1) stops.push([1, target]);
  } else stops.push([1, palette]);
  return {
    mode,
    stops,
    ...(target && !ghost && !comet
      ? {
          reignition: { at, duration: REIGNITION_DURATION, amount: REIGNITION_AMOUNT },
        }
      : {}),
  };
}
function layer(value, index) {
  const { colours, colourMode, changeTo, changeAt, head, trail, effect, twist, delay, ...fields } =
    value;
  const modifiers = [];
  if (twist) modifiers.push(mapped('modifier', { kind: 'twist', angular_speed_rad_s: twist }));
  if (effect.kind !== 'none')
    modifiers.push(
      mapped('modifier', effect, {
        rate: effect.kind === 'fish' ? 'rate_rad_s' : 'rate_hz',
      }),
    );
  const { brightness, ...headFields } = head;
  return {
    ...mapped('layer', fields, {
      radius: 'radius_m',
      speedVar: 'speed_var',
      drag: 'drag_per_s',
      gravity: 'gravity_m_s2',
      life: 'life_s',
      lifeVar: 'life_var',
      offset: 'offset_m',
    }),
    id: `l${index + 1}`,
    delay_s: 0,
    colour: colour(colours, colourMode, changeTo, changeAt, effect.kind === 'ghost'),
    brightness: [
      [0, brightness],
      [1, brightness],
    ],
    head: headFields,
    trail: {
      colour: 'house',
      ...mapped('trail', trail, {
        length: 'length_s',
        spread: 'spread_m_s',
        gravity: 'gravity_m_s2',
        drag: 'drag_per_s',
        glitterDelay: 'glitter_delay_s',
      }),
    },
    modifiers,
  };
}
function convert(d) {
  const base = {
    kind: d.kind,
    launch: null,
    breaks: [],
    ground: null,
    sound: defaults('sound'),
    seed: TEMPLATE_SEED,
  };
  if (['shell', 'mine', 'rocket'].includes(d.kind)) {
    base.launch = mapped('launch', d.launch, {
      height: 'height_m',
      time: 'time_s',
      tilt: 'tilt_deg',
      style: 'tail',
    });
    for (const [index, value] of d.layers.entries()) {
      let entry = base.breaks.find((b) => b.at_s === value.delay);
      if (!entry) {
        entry = {
          at_s: value.delay,
          core: mapped('core', d.core, { flashOn: 'flash_on' }),
          fade: mapped('fade', d.fade, {
            whiteHot: 'white_hot',
            emberAt: 'ember_at',
            fadeAt: 'fade_at',
            prime: 'prime_s',
          }),
          layers: [],
        };
        base.breaks.push(entry);
      }
      entry.layers.push(layer(value, index));
    }
    // Preserve flat layer indices: grouping must never change the reference's seed order.
    if (base.breaks.flatMap((b) => b.layers).some((l, i) => l.id !== `l${i + 1}`))
      throw new Error(`Interleaved breaks in ${d.key}`);
  } else {
    const block = d.kind === 'comet' || d.kind === 'candle' ? 'comets' : d.kind;
    const v = d[block];
    let converted;
    if (block === 'comets') {
      const { colour: single, colours, changeTo, changeAt, split, trail, ...fields } = v;
      converted = {
        ...mapped(block, fields, {
          spread: 'spread_deg',
          height: 'height_m',
          time: 'time_s',
          gap: 'gap_s',
          tailLife: 'tail_life_s',
          spin: 'spin_rad_s',
          spinR: 'spin_radius_m',
        }),
        colour: colour(
          colours ?? single,
          'alternate',
          changeTo,
          changeAt ?? COMET_CHANGE_AT,
          false,
          true,
        ),
        trail: trail ?? 'house',
        split: split ? mapped('split', split, { distance: 'distance_m', life: 'life_s' }) : null,
      };
      // Sweep rows use a shorter prototype fallback than sequential candles.
      if (!v.gap && v.pattern === 'sweep') converted.gap_s = SWEEP_GAP_S;
    } else
      converted = mapped(block, v, {
        duration: 'duration_s',
        rate: 'rate_per_s',
        speed: 'speed_m_s',
        life: 'life_s',
        height: 'height_m',
        spacing: 'spacing_m',
        dir: 'direction',
        gravity: 'gravity_m_s2',
        drag: 'drag_per_s',
        glowAlpha: 'glow_alpha',
        time: 'time_s',
        radius: 'radius_m',
        spin: block === 'wheel' ? 'spin_hz' : 'spin_rad_s',
        wander: 'wander_m',
      });
    if (block === 'fountain') {
      converted.direction ??= [0, 1, 0];
      if (v.height === undefined) converted.glow_height_m = FOUNTAIN_GLOW_HEIGHT_M;
    }
    base.ground = { kind: d.kind, [block]: converted };
  }
  return upgradeDesign(base, 1);
}
mkdirSync(output, { recursive: true });
const entries = Object.keys(ref.PRESETS).map((key) => {
  const d = ref.design(key);
  const entry = { key, name: d.name, group: d.group, design: convert(d) };
  writeFileSync(new URL(`${key}.json`, output), `${JSON.stringify(entry, null, 2)}\n`);
  return entry;
});
const imports = entries
  .map((e) => `import ${e.key} from './${e.key}.json' with { type: 'json' };`)
  .join('\n');
const keys = entries.map((e) => JSON.stringify(e.key)).join(' | ');
const groups = [...new Set(entries.map((e) => e.group))].map((g) => JSON.stringify(g)).join(' | ');
writeFileSync(
  new URL('index.ts', output),
  `/** Catalogue metadata and validated stored designs for the built-in effect library. */\nimport { upgradeDesign, type Design } from '../schema/index';\n${imports}\n\nexport type EffectTemplateKey = ${keys};\nexport type EffectTemplateGroup = ${groups};\n\n/** Catalogue identity stays outside the renderer's design document. */\nexport interface EffectTemplate {\n  readonly key: EffectTemplateKey;\n  readonly name: string;\n  readonly group: EffectTemplateGroup;\n  readonly design: Design;\n}\n\n/** Built-in templates in prototype catalogue order, validated on loading. */\nexport const effectTemplates: readonly EffectTemplate[] = [\n${entries.map((e) => `  { key: '${e.key}', name: ${e.key}.name, group: '${e.group}', design: upgradeDesign(${e.key}.design, 1) },`).join('\n')}\n];\n`,
);
console.log(`Converted ${entries.length} templates`);
