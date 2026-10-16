/** Turns a parsed VDL description into renderer designs: one shell per shot plus any mines or comets. */
import { effectTemplates, resolveDesign, upgradeDesign, type Design } from '@showcrafter/renderer';
import type {
  VdlAdjectiveTarget,
  VdlFamily,
  VdlLayerPatch,
  VdlModifier,
  VdlTail,
} from './glossary.ts';
import type { VdlPhase, VdlPhrase, VdlSegment } from './phrase.ts';
import type { EncodedEffect } from './encoded.ts';

type BreakDesign = Extract<Design, { kind: 'shell' | 'mine' }>;
type Layer = BreakDesign['breaks'][number]['layers'][number];
type Modifier = Layer['modifiers'][number];
type CometDesign = Extract<Design, { kind: 'comet' }>;
type TourbillonDesign = Extract<Design, { kind: 'tourbillon' }>;

const DESIGN_VERSION = 1; // Stored renderer schema version.
const MAX_LEVEL = 3; // Stored adjustment range, levels either side of zero.
const DEFAULT_CALIBER_MM = 30; // Typical consumer cake shot when the line gives no caliber, millimetres.
// Finale 3D's physical defaults. Heights and spreads follow them literally, so a show
// looks the same here as when its exported script is opened in Finale.
// Measured against Finale 3D: a 30 mm "Small" charcoal willow spans about 34 m, so the
// unadjusted break is roughly 0.6 m of radius per millimetre of caliber.
const FINALE_RADIUS_M_PER_MM = 0.6; // Finale's default break radius per millimetre, metres.
const FINALE_HEIGHT_M_PER_MM = 1; // Finale's default height per millimetre, metres.
// Finale's 30 m cake shells break 1.75 to 1.95 s after firing; lift follows the square root of height.
const FINALE_LIFT_S_PER_ROOT_M = 0.34; // Lift seconds per square-root metre of height.
// Finale counts about 36 stars in a plain 30 mm break; Dense/Sparse levels scale from there.
const FINALE_STARS_PER_MM = 1.2; // Main-layer stars per millimetre of caliber.
// DUR is Finale's burn before the fade: a 0.8 DUR gold peony is bright at 0.85 s and gone by 1.25 s.
const FINALE_BURN_TO_LIFE = 1.4; // Star life as a multiple of the DUR burn.
// Gold, silver and charcoal stars leave a short trail of sparks in Finale.
const FINALE_SPARK_TRAIL_S = 0.6; // Trail length for spark-trailing star colours, seconds.
const FINALE_SPARK_TRAIL_SPARKS = 60; // Spark density on those trails, which Finale draws as streaks.
const FINALE_SPARK_HEAD_SIZE = 0.35; // Head size on spark-trailing stars; the streak dominates.
// Brocade and kamuro are drawn by their glittering trails: Finale shows short-lived stars
// trailing dense, drooping gold streaks that are gone about 2.4 s after the break.
const TRAIL_LED_TEMPLATES = new Set(['brocade', 'kamuro', 'brocadeCrown', 'glitterWillow']);
const TRAIL_LED_LIFE_S = 1.4; // Star burn for trail-led effects, seconds.
const TRAIL_LED_TRAIL_S = 1; // Trail length for trail-led effects, seconds.
const TRAIL_LED_SPARKS = 90; // Trail spark density for trail-led effects.
const TRAIL_LED_GRAVITY = 7; // Droop for trail-led effects, metres per second squared.
const TRAIL_LED_GLITTER = 0.3; // Most trail blinking; Finale's brocade streaks read continuous.
const TRAIL_LED_COLOUR = '#ffdc9a'; // Finale's pale gold brocade streak, matching its gold sparks.
// The mine under a "Mine To … Shell" part reaches about 0.6 of the shell height in Finale
// (18 m under a 30 m shell), with a sparse fan of thin streaks.
const MINE_TO_SHELL_REACH = 0.6; // Mine reach as a fraction of the shell height.
const MINE_TO_SHELL_STARS = 40; // Streaks in that mine's fan.
const FINALE_MINE_REACH_M_PER_MM = 0.45; // Plain mine height per millimetre of caliber, metres.
const FINALE_MINE_STARS_PER_MM = 0.4; // Plain mine stars per millimetre of caliber.
const MINE_TO_SHELL_TRAIL_S = 1.5; // Trail length on those stars, seconds.
// Strong drag and light gravity let the streaks travel close to their reach before they
// fade, as Finale's straight mine fans do; plain gravity pulled them back to the ground.
const MINE_TO_SHELL_GRAVITY = 4; // Gravity on those stars, metres per second squared.
const MINE_TO_SHELL_DRAG = 1.5; // Drag on those stars, per second.
const MINE_TO_SHELL_RADIUS = 1.1; // Star radius relative to the reach, offsetting the residual fall.
const EXTRA_LAYER_COUNT = 0.6; // Star share for a second layer, fraction.
// Finale draws a "w/ … Shell" companion at full size; its own adjectives (Small, Big) scale it.
const EXTRA_LAYER_RADIUS = 1; // Companion layer radius relative to the main break, fraction.
const COMPANION_HEAD_SIZE = 0.5; // Largest companion star head; Finale's colour pips are fine points.
// Finale's default star burn and trail time (before Long/Short levels): its shells
// fade within about two seconds, measured against charcoal willow and gold peony cakes.
const FINALE_STAR_LIFE_S = 2; // Default star burn, seconds.
const FINALE_TRAIL_S = 1; // Longest default spark trail, seconds.
const FINALE_TRAIL_SPARKS = 36; // Densest default spark trail, sparks; Finale trails are thin lines.
// Finale's breaks open to nearly full size within half a second, then barely droop over
// the two-second burn: quick drag, light gravity.
const FINALE_STAR_DRAG_PER_S = 3; // Default star drag, per second.
const FINALE_STAR_GRAVITY = 4; // Largest default star gravity, metres per second squared.
const PISTIL_RADIUS = 0.45; // Pistil radius relative to the outer break, fraction.
const PISTIL_COUNT = 0.4; // Pistil star count relative to the outer break, fraction.
const PISTIL_LIFE = 0.85; // Pistil burn time relative to the outer break, fraction.
const BOMBETTE_RADIUS = 0.6; // Bombette spread relative to the outer break, fraction.
const BOMBETTE_COUNT = 6; // Bombettes per shot.
const BOMBETTE_PIECES = 12; // Stars from each bombette.
const BOMBETTE_SPLIT_AT = 0.35; // Bombette split point, star life fraction.
const COMET_FACTOR = 1.3; // Comet trail change per level, multiplier.
const WHISTLE_SOUND = 0.8; // Whistle loudness for whistling tails and comets, fraction.
const CRACKLE_SOUND = 0.8; // Crackle loudness for crackling stars, fraction.
const NEUTRAL_STAR = '#ffd27a'; // Warm star colour when a multi-colour template gets no colour words.
const NEUTRAL_TEMPLATES = new Set(['peony', 'mine']); // Templates whose own colours are arbitrary examples.
const MAX_NAME_LENGTH = 180; // Catalogue name limit, characters.
const SEED_MODULUS = 2 ** 32; // Design seed range.

export interface VdlFireworkPlan {
  key: string;
  name: string;
  family: VdlFamily;
  templateKey: string;
  templateName: string;
  design: Design;
  heightM: number | null;
}

interface Context {
  caliberMm: number | null;
  caliberText: string | null;
  encoded: EncodedEffect | null;
  approximations: string[];
}

function template(key: string): Design {
  const found = effectTemplates.find((item) => item.key === key);
  if (!found) throw new Error(`Unknown base effect ${key}.`);
  return structuredClone(found.design);
}

function seed(text: string): number {
  let hash = 2166136261;
  for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % SEED_MODULUS;
}

function caliber(context: Context, segment?: VdlSegment): number {
  return (
    segment?.caliberMm ?? context.encoded?.caliberMm ?? context.caliberMm ?? DEFAULT_CALIBER_MM
  );
}

/** Size relative to the template: area-like growth with caliber, kept near template size. */
/** How much an edited Finale value differs from Finale's default for the caliber. */
/** Finale's literal height (HTM, or the encoded height), else its default for the caliber, metres. */
function finaleHeightM(mm: number, htm: number | null | undefined): number {
  return htm ?? mm * FINALE_HEIGHT_M_PER_MM;
}

/** Largest break radius in a design, metres. */
function outerRadiusM(design: BreakDesign): number {
  return Math.max(...design.breaks.flatMap((burst) => burst.layers.map((layer) => layer.radius_m)));
}

function round(value: number, places = 2): number {
  return Number(value.toFixed(places));
}

/** Lift time follows the template's climb, scaled by √height like a real lift. */
function liftTime(templateHeightM: number, templateTimeS: number, heightM: number): number {
  return round(templateTimeS * Math.sqrt(heightM / templateHeightM), 3);
}

function isRising(phase: VdlPhase): boolean {
  return (
    phase.devices.has('tail') ||
    phase.devices.has('comet') ||
    phase.devices.has('rising') ||
    phase.devices.has('mine') ||
    (phase.effect !== null && phase.effect.family !== 'shell')
  );
}

/** Splits a segment into rising phases (launch tail) and break phases. */
function phasesOf(segment: VdlSegment): { rising: VdlPhase[]; breaks: VdlPhase[] } {
  const [first, ...rest] = segment.phases;
  if (rest.length > 0 && isRising(first)) return { rising: [first], breaks: rest };
  return { rising: [], breaks: segment.phases };
}

function familyOf(segment: VdlSegment): VdlFamily | 'tail' {
  const { rising, breaks } = phasesOf(segment);
  if (rising.length > 0) return 'shell';
  const phase = breaks[0];
  const effectFamily = phase.effect?.family ?? null;
  if (effectFamily && effectFamily !== 'shell') return effectFamily;
  if (phase.devices.has('mine')) return 'mine';
  if (phase.devices.has('comet') && !phase.effect && !phase.devices.has('shell')) return 'comet';
  if (phase.devices.has('tail') && !phase.devices.has('shell')) return 'tail';
  return 'shell';
}

function tailOf(phases: VdlPhase[]): VdlTail | null {
  const tails = phases.flatMap((phase) => phase.tails);
  const priority: VdlTail[] = [
    'whistle',
    'heli',
    'crackle',
    'strobe',
    'willow',
    'brocade',
    'glitter',
    'comet',
    'silver',
    'gold',
    'dark',
  ];
  for (const candidate of priority) if (tails.includes(candidate)) return candidate;
  if (phases.some((phase) => phase.devices.has('comet'))) return 'comet';
  return null;
}

function stopsFor(colours: string[][], positions: number[]): Layer['colour'] | null {
  const stops: [number, string[]][] = [];
  colours.forEach((list, index) => {
    if (list.length) stops.push([positions[index] ?? 0, list]);
  });
  if (stops.length === 0) return null;
  stops[0] = [0, stops[0][1]];
  stops.push([1, stops[stops.length - 1][1]]);
  const multiple = stops.some(([, list]) => list.length > 1);
  return { mode: multiple ? 'alternate' : 'solid', stops };
}

function fullModifier(partial: VdlModifier, at: number): Modifier {
  return {
    kind: partial.kind,
    at: Math.max(partial.at ?? 0.5, at),
    rate_hz: partial.rate_hz ?? 12,
    count: partial.count ?? 8,
    amount: partial.amount ?? 1,
    spread: partial.spread ?? 'burst',
    gap: 0.12,
    angular_speed_rad_s: 0,
    rate_rad_s: 12,
  };
}

function patchLayer(layer: Layer, patch: VdlLayerPatch) {
  if (patch.pattern !== undefined) layer.pattern = patch.pattern;
  if (patch.speed_var !== undefined) layer.speed_var = patch.speed_var;
  if (patch.gravity_m_s2 !== undefined) layer.gravity_m_s2 = patch.gravity_m_s2;
  if (patch.brightness !== undefined)
    layer.brightness = [
      [0, patch.brightness],
      [1, patch.brightness],
    ];
  if (patch.head_size !== undefined) layer.head.size = patch.head_size;
  if (patch.head_visible !== undefined) layer.head.visible = patch.head_visible;
  if (patch.trail_sparks !== undefined) layer.trail.sparks = patch.trail_sparks;
  if (patch.trail_length_s !== undefined) layer.trail.length_s = patch.trail_length_s;
  if (patch.trail_colour !== undefined) layer.trail.colour = patch.trail_colour;
  if (patch.trail_glitter !== undefined) layer.trail.glitter = patch.trail_glitter;
}

/** Applies the words of a break's phases to one layer and returns its adjective levels. */
function dressLayer(
  layer: Layer,
  phases: VdlPhase[],
  offset: number,
  total: number,
  neutral = false,
) {
  const positions = phases.map((_, index) => (offset + index) / total);
  const colours = phases.map((phase) => phase.colours);
  const anyColour = colours.some((list) => list.length > 0);
  const starColour = phases.find((phase) => phase.trailColour)?.trailColour ?? null;
  const tip = phases.find((phase) => phase.tip)?.tip ?? null;
  const stops = stopsFor(
    anyColour
      ? colours
      : colours.map((_, index) =>
          index === 0 && (tip ?? starColour) ? [tip ?? starColour?.star ?? ''] : [],
        ),
    positions,
  );
  if (stops) layer.colour = stops;
  else if (neutral)
    layer.colour = {
      mode: 'solid',
      stops: [
        [0, [NEUTRAL_STAR]],
        [1, [NEUTRAL_STAR]],
      ],
    };
  if (starColour)
    Object.assign(layer.trail, {
      colour: starColour.colour,
      sparks: Math.max(layer.trail.sparks, FINALE_SPARK_TRAIL_SPARKS),
      length_s: Math.max(layer.trail.length_s, FINALE_SPARK_TRAIL_S),
    });
  if (starColour) layer.head.size = Math.min(layer.head.size, FINALE_SPARK_HEAD_SIZE);
  if (tip) layer.trail.sparks = 0;
  phases.forEach((phase, index) => {
    phase.patches.forEach((patch) => patchLayer(layer, patch));
    for (const partial of phase.modifiers) {
      if (layer.modifiers.length >= 16) break;
      const modifier = fullModifier(partial, positions[index] ?? 0);
      const existing = layer.modifiers.findIndex((item) => item.kind === modifier.kind);
      if (existing >= 0) layer.modifiers[existing] = modifier;
      else layer.modifiers.push(modifier);
    }
  });
  const levels = new Map<VdlAdjectiveTarget, number>();
  for (const phase of phases)
    for (const [target, level] of phase.levels)
      levels.set(target, (levels.get(target) ?? 0) + level);
  return levels;
}

const LAYER_KEYS: Partial<Record<VdlAdjectiveTarget, string>> = {
  size: 'size',
  stars: 'stars',
  burn: 'burn',
  brightness: 'brightness',
  star_size: 'star_size',
  'trail.length': 'trail.length',
  'trail.density': 'trail.density',
  'trail.spray': 'trail.spray',
  spread: 'spread',
  droop: 'droop',
  speed: 'modifier.amount',
};

/** Stores up to ±3 as editable levels and bakes anything beyond into the design values. */
function applyLevels(design: Design, levels: Map<string, number>): Design {
  let current = design;
  const stored: Record<string, number> = {};
  for (const [key, level] of levels) {
    const kept = Math.max(-MAX_LEVEL, Math.min(MAX_LEVEL, level));
    if (kept !== 0) stored[key] = kept;
    let excess = level - kept;
    while (excess !== 0) {
      const step = Math.max(-MAX_LEVEL, Math.min(MAX_LEVEL, excess));
      current = resolveDesign({ ...current, adjustments: { [key]: step } } as Design);
      excess -= step;
    }
  }
  const result = structuredClone(current);
  if (Object.keys(stored).length) result.adjustments = stored;
  else delete result.adjustments;
  return result;
}

function nextLayerId(design: BreakDesign): string {
  const ids = new Set(design.breaks.flatMap((item) => item.layers.map((layer) => layer.id)));
  let index = 1;
  while (ids.has(`l${index}`)) index += 1;
  return `l${index}`;
}

function scaleLayers(design: BreakDesign, radiusScale: number, countScale: number) {
  for (const item of design.breaks)
    for (const layer of item.layers) {
      layer.radius_m = round(layer.radius_m * radiusScale);
      if (layer.count > 0) layer.count = Math.max(3, Math.round(layer.count * countScale));
    }
}

function setLife(design: BreakDesign, lifeS: number) {
  const outer = design.breaks[0].layers[0];
  const factor = outer.life_s > 0 ? lifeS / outer.life_s : 1;
  for (const item of design.breaks)
    for (const layer of item.layers)
      layer.life_s = Math.min(120, Math.max(0.05, layer.life_s * factor));
}

function displayName(text: string, context: Context, segment?: VdlSegment): string {
  const prefix = segment?.caliberMm || !context.caliberText ? '' : `${context.caliberText} `;
  const name = `${prefix}${text}`.replace(/\s+/g, ' ').trim();
  return name.length <= MAX_NAME_LENGTH ? name : `${name.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…`;
}

function shellFirework(
  segments: VdlSegment[],
  tailSegments: VdlSegment[],
  context: Context,
): Omit<VdlFireworkPlan, 'templateName'> {
  const split = segments.map((segment) => ({ segment, ...phasesOf(segment) }));
  const base = split
    .flatMap((item) => item.breaks)
    .find((phase) => phase.effect?.family === 'shell')?.effect;
  const templateKey = base?.template ?? 'peony';
  const design = template(templateKey) as BreakDesign;
  if (design.kind !== 'shell' && design.kind !== 'mine')
    throw new Error(`${templateKey} has no break.`);
  const baseLayer = structuredClone(design.breaks[0].layers[0]);
  const levels = new Map<string, number>();
  // "… Willow Tail" on its own is a rising tail with no visible break.
  const tailOnly = split.every(({ breaks }) =>
    breaks.every((phase) => phase.devices.has('tail') && !phase.devices.has('shell')),
  );
  const rising = split.flatMap((item) =>
    tailOnly ? [...item.rising, ...item.breaks] : item.rising,
  );
  const allTailPhases = [...rising, ...tailSegments.flatMap((segment) => segment.phases)];
  split.forEach(({ segment, breaks }, index) => {
    const nounPhase = breaks.find((phase) => phase.effect?.family === 'shell');
    const pistil = breaks.some((phase) => phase.devices.has('pistil'));
    const bombette = breaks.some((phase) => phase.devices.has('bombette'));
    let layer: Layer;
    if (index === 0) {
      layer = design.breaks[0].layers[0];
    } else {
      // A companion named only by colour ("w/ Purple Shell") is a plain trail-less peony in Finale.
      const source = template(nounPhase?.effect ? nounPhase.effect.template : 'peony');
      const sourceLayer =
        source.kind === 'shell' || source.kind === 'mine' ? source.breaks[0].layers[0] : baseLayer;
      layer = structuredClone(sourceLayer);
      layer.id = nextLayerId(design);
      layer.name = segment.text.slice(0, 120) || 'Layer';
      layer.radius_m = baseLayer.radius_m * EXTRA_LAYER_RADIUS;
      layer.head.size = Math.min(layer.head.size, COMPANION_HEAD_SIZE);
      layer.count = Math.max(3, Math.round(sourceLayer.count * EXTRA_LAYER_COUNT));
      if (pistil) {
        layer.radius_m = baseLayer.radius_m * PISTIL_RADIUS;
        layer.count = Math.max(3, Math.round(baseLayer.count * PISTIL_COUNT));
        layer.life_s = baseLayer.life_s * PISTIL_LIFE;
      }
      if (bombette) {
        layer.pattern = 'random';
        layer.count = BOMBETTE_COUNT;
        layer.radius_m = baseLayer.radius_m * BOMBETTE_RADIUS;
        layer.head.size = 0.6;
        layer.modifiers = [
          fullModifier({ kind: 'split', count: BOMBETTE_PIECES, at: BOMBETTE_SPLIT_AT }, 0),
        ];
      }
      if (design.breaks[0].layers.length >= 32) return;
      design.breaks[0].layers.push(layer);
    }
    const layerLevels = dressLayer(
      layer,
      breaks,
      0,
      Math.max(1, breaks.length),
      NEUTRAL_TEMPLATES.has(templateKey),
    );
    if (tailOnly) return;
    for (const [target, level] of layerLevels) {
      const key = LAYER_KEYS[target];
      if (key)
        levels.set(
          `layer.${layer.id}.${key}`,
          (levels.get(`layer.${layer.id}.${key}`) ?? 0) + level,
        );
    }
    if (breaks.some((phase) => phase.sounds.has('crackle'))) design.sound.crackle = CRACKLE_SOUND;
  });
  if (rising.some((phase) => phase.colours.length > 0))
    context.approximations.push('Coloured rising tails are drawn in the tail style colour.');
  if (design.launch) {
    const tail = tailOf(allTailPhases);
    if (tail) design.launch.tail = tail;
    if (tail === 'whistle') design.sound.whistle = WHISTLE_SOUND;
    for (const phase of allTailPhases) {
      const density =
        (phase.levels.get('trail.density') ?? 0) + (phase.levels.get('trail.length') ?? 0);
      if (density) levels.set('launch.tail', (levels.get('launch.tail') ?? 0) + density);
      const speed = phase.levels.get('speed') ?? 0;
      if (speed) levels.set('launch.climb', (levels.get('launch.climb') ?? 0) + speed);
    }
  }
  if (tailOnly) for (const layer of design.breaks[0].layers) layer.hidden = true;
  const numbers = Object.assign(
    {},
    ...segments.map((segment) => segment.numbers),
  ) as VdlSegment['numbers'];
  const mm = caliber(context, segments[0]);
  const encoded = context.encoded;
  // Finale's break grows with burn time: a short DUR burn travels less far.
  const lifeS = numbers.DUR !== undefined ? numbers.DUR * FINALE_BURN_TO_LIFE : FINALE_STAR_LIFE_S;
  const burnScale = Math.sqrt(Math.min(1, lifeS / FINALE_STAR_LIFE_S));
  const radius = encoded?.breakRadiusM ?? mm * FINALE_RADIUS_M_PER_MM * burnScale;
  const stars = FINALE_STARS_PER_MM * mm;
  scaleLayers(design, radius / outerRadiusM(design), stars / design.breaks[0].layers[0].count);
  if (encoded?.breakRadiusM)
    for (const key of [...levels.keys()]) if (key.endsWith('.size')) levels.delete(key);
  if (numbers.DUR !== undefined) {
    setLife(design, lifeS);
    for (const key of [...levels.keys()]) if (key.endsWith('.burn')) levels.delete(key);
  } else
    setLife(design, TRAIL_LED_TEMPLATES.has(templateKey) ? TRAIL_LED_LIFE_S : FINALE_STAR_LIFE_S);
  for (const layer of design.breaks.flatMap((burst) => burst.layers)) {
    Object.assign(layer.trail, {
      length_s: Math.min(layer.trail.length_s, FINALE_TRAIL_S),
      sparks: Math.min(
        layer.trail.sparks,
        Math.max(FINALE_TRAIL_SPARKS, FINALE_SPARK_TRAIL_SPARKS),
      ),
    });
    layer.drag_per_s = FINALE_STAR_DRAG_PER_S;
    layer.gravity_m_s2 = Math.min(layer.gravity_m_s2, FINALE_STAR_GRAVITY);
    if (TRAIL_LED_TEMPLATES.has(templateKey) && layer.trail.sparks > 0) {
      Object.assign(layer.trail, {
        length_s: TRAIL_LED_TRAIL_S,
        sparks: TRAIL_LED_SPARKS,
        glitter: Math.min(layer.trail.glitter, TRAIL_LED_GLITTER),
        colour: TRAIL_LED_COLOUR,
      });
      layer.gravity_m_s2 = TRAIL_LED_GRAVITY;
      layer.head.size = Math.min(layer.head.size, FINALE_SPARK_HEAD_SIZE);
    }
  }
  // HTM and LFT are Finale's literal metres and seconds.
  const height = round(finaleHeightM(mm, numbers.HTM ?? encoded?.heightM), 1);
  const finaleLift = numbers.LFT ?? encoded?.liftS;
  design.launch.time_s = round(finaleLift ?? FINALE_LIFT_S_PER_ROOT_M * Math.sqrt(height), 3);
  design.launch.height_m = height;
  const text = [...segments, ...tailSegments].map((segment) => segment.text).join(' w/ ');
  design.seed = seed(text);
  return {
    key: '',
    name: displayName(text, context, segments[0]),
    family: 'shell',
    templateKey,
    design: applyLevels(design, levels),
    heightM: height,
  };
}

function mineFirework(
  segment: VdlSegment,
  context: Context,
): Omit<VdlFireworkPlan, 'templateName'> {
  const phase = segment.phases[segment.phases.length - 1];
  const templateKey = phase.effect?.family === 'mine' ? phase.effect.template : 'mine';
  const design = template(templateKey) as BreakDesign;
  const layer = design.breaks[0].layers[0];
  if (phase.effect?.family === 'shell') {
    const look = template(phase.effect.template);
    if (look.kind === 'shell' || look.kind === 'mine') {
      layer.trail = structuredClone(look.breaks[0].layers[0].trail);
      layer.colour = structuredClone(look.breaks[0].layers[0].colour);
    }
  }
  const levels = new Map<string, number>();
  const neutral = NEUTRAL_TEMPLATES.has(templateKey) && phase.effect?.family !== 'shell';
  for (const [target, level] of dressLayer(layer, segment.phases, 0, 1, neutral)) {
    const key = LAYER_KEYS[target];
    if (key)
      levels.set(`layer.${layer.id}.${key}`, (levels.get(`layer.${layer.id}.${key}`) ?? 0) + level);
  }
  if (segment.phases.some((item) => item.sounds.has('crackle')))
    design.sound.crackle = CRACKLE_SOUND;
  const mm = caliber(context, segment);
  // Finale's plain mine is a sparse spray about 0.45 m high per millimetre (11 m for 25 mm);
  // HTM gives its height literally.
  const reach = round(segment.numbers.HTM ?? mm * FINALE_MINE_REACH_M_PER_MM, 1);
  scaleLayers(design, 1, (FINALE_MINE_STARS_PER_MM * mm) / design.breaks[0].layers[0].count);
  for (const layer of design.breaks[0].layers) {
    // Strong drag and light gravity keep the streaks near their reach until they fade.
    layer.radius_m = round(reach * MINE_TO_SHELL_RADIUS);
    layer.drag_per_s = MINE_TO_SHELL_DRAG;
    layer.gravity_m_s2 = MINE_TO_SHELL_GRAVITY;
    Object.assign(layer.trail, {
      length_s: Math.min(layer.trail.length_s, FINALE_TRAIL_S),
      sparks: Math.min(layer.trail.sparks, FINALE_TRAIL_SPARKS),
    });
    // A coloured mine star with no spark colour word trails in its own colour, as in Finale.
    const star = layer.colour.stops[0]?.[1];
    const starHex = Array.isArray(star) ? star[0] : star;
    if (!segment.phases.some((item) => item.trailColour) && typeof starHex === 'string')
      layer.trail.colour = starHex;
  }
  if (segment.numbers.DUR !== undefined) setLife(design, segment.numbers.DUR);
  context.approximations.push('Mine height is approximated from the spread of its stars.');
  design.seed = seed(segment.text);
  return {
    key: '',
    name: displayName(segment.text, context, segment),
    family: 'mine',
    templateKey,
    design: applyLevels(design, levels),
    heightM: reach,
  };
}

function cometFirework(
  segment: VdlSegment,
  context: Context,
): Omit<VdlFireworkPlan, 'templateName'> {
  const phases = segment.phases;
  const effect = phases.find((phase) => phase.effect?.family === 'comet')?.effect;
  const templateKey = effect?.template ?? 'whiteComet';
  const design = template(templateKey) as CometDesign;
  const comets = design.ground.comets;
  const colours = phases.flatMap((phase) => phase.colours);
  const trailColour = phases.find((phase) => phase.trailColour)?.trailColour ?? null;
  const starColours = colours.length ? colours : trailColour ? [trailColour.star] : [];
  if (starColours.length)
    comets.colour = {
      mode: 'alternate',
      stops: [
        [0, starColours],
        [1, starColours],
      ],
    };
  if (trailColour) comets.trail = trailColour.colour;
  if (phases.some((phase) => phase.patches.some((patch) => patch.trail_sparks === 0)))
    comets.sparks = 0;
  if (phases.some((phase) => phase.modifiers.length > 0))
    context.approximations.push('Strobing and crackling comets are drawn as plain comets.');
  const levels = new Map<string, number>();
  for (const phase of phases)
    for (const [target, level] of phase.levels) {
      if (target === 'size' || target === 'brightness')
        levels.set('ground.star_size', (levels.get('ground.star_size') ?? 0) + level);
      else if (target === 'stars')
        levels.set('ground.count', (levels.get('ground.count') ?? 0) + level);
      else if (target === 'speed')
        levels.set('ground.climb', (levels.get('ground.climb') ?? 0) + level);
      else if (target === 'trail.length' || target === 'burn')
        comets.tail_life_s = Math.min(
          30,
          Math.max(0.05, comets.tail_life_s * COMET_FACTOR ** level),
        );
      else if (target === 'trail.density')
        comets.sparks = Math.min(
          10000,
          Math.max(0, Math.round(comets.sparks * COMET_FACTOR ** level)),
        );
    }
  if (phases.some((phase) => phase.sounds.has('whistle'))) design.sound.whistle = WHISTLE_SOUND;
  const mm = caliber(context, segment);
  const height = round(finaleHeightM(mm, segment.numbers.HTM), 1);
  comets.time_s = segment.numbers.DUR ?? liftTime(comets.height_m, comets.time_s, height);
  comets.height_m = height;
  design.seed = seed(segment.text);
  return {
    key: '',
    name: displayName(segment.text, context, segment),
    family: 'comet',
    templateKey,
    design: applyLevels(design, levels),
    heightM: height,
  };
}

function tourbillonFirework(
  segment: VdlSegment,
  context: Context,
): Omit<VdlFireworkPlan, 'templateName'> {
  const design = template('tourbillon') as TourbillonDesign;
  const tourbillon = design.ground.tourbillon;
  const mm = caliber(context, segment);
  const height = round(finaleHeightM(mm, segment.numbers.HTM), 1);
  tourbillon.time_s =
    segment.numbers.DUR ?? liftTime(tourbillon.height_m, tourbillon.time_s, height);
  tourbillon.height_m = height;
  const density = segment.phases.reduce(
    (sum, phase) => sum + (phase.levels.get('trail.density') ?? 0),
    0,
  );
  tourbillon.sparks = Math.min(
    10000,
    Math.max(0, Math.round(tourbillon.sparks * COMET_FACTOR ** density)),
  );
  design.seed = seed(segment.text);
  return {
    key: '',
    name: displayName(segment.text, context, segment),
    family: 'tourbillon',
    templateKey: 'tourbillon',
    design,
    heightM: height,
  };
}

/** Builds and validates every firework one lettered part needs, in firing order. */
export function buildVdlFireworks(
  phrase: VdlPhrase,
  options: { caliberMm: number | null; caliberText: string | null; encoded: EncodedEffect | null },
): { fireworks: VdlFireworkPlan[]; approximations: string[] } {
  const context: Context = { ...options, approximations: [] };
  const shellSegments: VdlSegment[] = [];
  const tailSegments: VdlSegment[] = [];
  const others: { segment: VdlSegment; family: VdlFamily }[] = [];
  phrase.segments.forEach((segment, index) => {
    const family = familyOf(segment);
    if (family === 'tail' && index > 0) tailSegments.push(segment);
    else if (family === 'tail' || family === 'shell') shellSegments.push(segment);
    else others.push({ segment, family });
  });
  const fireworks: Omit<VdlFireworkPlan, 'templateName'>[] = [];
  // "… Mine To … Shell" fires a ground mine with the shell rising through it; Finale
  // draws both, so the mine phase becomes its own mine as well as the shell's lift.
  for (const segment of shellSegments) {
    const { rising } = phasesOf(segment);
    if (rising[0]?.devices.has('mine')) {
      const mm = caliber(context, segment);
      const reach = finaleHeightM(mm, segment.numbers.HTM) * MINE_TO_SHELL_REACH;
      // mineFirework reads HTM as the mine's own height.
      const mine = mineFirework(
        {
          ...segment,
          text: segment.text.split(/\s+to\s+/i)[0],
          phases: rising,
          numbers: { ...segment.numbers, HTM: reach },
        },
        context,
      );
      if (mine.design.kind === 'mine')
        for (const layer of mine.design.breaks[0].layers) {
          layer.count = MINE_TO_SHELL_STARS;
          layer.trail.length_s = MINE_TO_SHELL_TRAIL_S;
          layer.gravity_m_s2 = MINE_TO_SHELL_GRAVITY;
          layer.drag_per_s = MINE_TO_SHELL_DRAG;
          layer.radius_m = reach * MINE_TO_SHELL_RADIUS;
          // Charcoal fan streaks have no bright star at their tips.
          layer.head.visible = false;
          layer.count = MINE_TO_SHELL_STARS;
        }
      fireworks.push(mine);
    }
  }
  if (shellSegments.length) {
    const shell = shellFirework(shellSegments, tailSegments, context);
    // The shell rises inside its mine's fan, so Finale draws no separate lift tail.
    const fromMine = shellSegments.some((segment) =>
      phasesOf(segment).rising[0]?.devices.has('mine'),
    );
    if (fromMine && shell.design.kind === 'shell') shell.design.launch.tail = 'dark';
    fireworks.push(shell);
  } else if (tailSegments.length)
    context.approximations.push('A tail without a shell or comet is not drawn.');
  for (const { segment, family } of others) {
    if (family === 'mine') fireworks.push(mineFirework(segment, context));
    else if (family === 'comet') fireworks.push(cometFirework(segment, context));
    else fireworks.push(tourbillonFirework(segment, context));
  }
  return {
    fireworks: fireworks.map((firework, index) => ({
      ...firework,
      key: String(index),
      templateName:
        effectTemplates.find((item) => item.key === firework.templateKey)?.name ??
        firework.templateKey,
      design: upgradeDesign(firework.design, DESIGN_VERSION),
    })),
    approximations: [...new Set(context.approximations)],
  };
}
