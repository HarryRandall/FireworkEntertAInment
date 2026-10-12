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
// The catalogue draws cake shots at template size (its 1.87" cakes keep the 60 m, ~28 m-radius
// templates), so calibers scale gently around that rather than in literal metres per millimetre.
const TEMPLATE_CALIBER_MM = 50; // Caliber the templates are drawn at, millimetres.
const MIN_SIZE_SCALE = 0.75; // Smallest caliber scale for tiny cakes, fraction of template.
const MAX_SIZE_SCALE = 1.5; // Largest caliber scale for big shells, fraction of template.
// Finale's own defaults, used only to read an edited effect as bigger or smaller than usual.
const FINALE_RADIUS_M_PER_MM = 0.3; // Finale's default break radius per millimetre, metres.
const FINALE_HEIGHT_M_PER_MM = 1; // Finale's default height per millimetre, metres.
const MIN_FINALE_RATIO = 0.5; // Smallest edited-effect change applied, fraction.
const MAX_FINALE_RATIO = 2; // Largest edited-effect change applied, fraction.
const EXTRA_LAYER_COUNT = 0.6; // Star share for a second full-size layer, fraction.
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Size relative to the template: area-like growth with caliber, kept near template size. */
function sizeScale(caliberMm: number): number {
  return clamp(Math.sqrt(caliberMm / TEMPLATE_CALIBER_MM), MIN_SIZE_SCALE, MAX_SIZE_SCALE);
}

/** How much an edited Finale value differs from Finale's default for the caliber. */
function finaleRatio(value: number | null | undefined, defaultValue: number): number {
  if (!value || defaultValue <= 0) return 1;
  return clamp(value / defaultValue, MIN_FINALE_RATIO, MAX_FINALE_RATIO);
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
  if (starColour) layer.trail.colour = starColour.colour;
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
      const source = nounPhase?.effect ? template(nounPhase.effect.template) : null;
      const sourceLayer =
        source && (source.kind === 'shell' || source.kind === 'mine')
          ? source.breaks[0].layers[0]
          : baseLayer;
      layer = structuredClone(sourceLayer);
      layer.id = nextLayerId(design);
      layer.name = segment.text.slice(0, 120) || 'Layer';
      layer.radius_m = baseLayer.radius_m;
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
  const scale = sizeScale(mm);
  const radiusRatio = finaleRatio(encoded?.breakRadiusM, mm * FINALE_RADIUS_M_PER_MM);
  scaleLayers(design, scale * radiusRatio, scale);
  if (encoded?.breakRadiusM)
    for (const key of [...levels.keys()]) if (key.endsWith('.size')) levels.delete(key);
  // Finale's star time for edited effects is a literal burn that looks far too short at
  // template size, so only an explicit DUR replaces the template's burn.
  if (numbers.DUR !== undefined) {
    setLife(design, numbers.DUR);
    for (const key of [...levels.keys()]) if (key.endsWith('.burn')) levels.delete(key);
  }
  // HTM and LFT are Finale's literal metres and seconds, read relative to Finale's defaults.
  const templateHeight = design.launch.height_m;
  const finaleHeight = numbers.HTM ?? encoded?.heightM ?? null;
  const finaleDefault = mm * FINALE_HEIGHT_M_PER_MM;
  const height = round(templateHeight * scale * finaleRatio(finaleHeight, finaleDefault), 1);
  const finaleLift = numbers.LFT ?? encoded?.liftS;
  design.launch.time_s = finaleLift
    ? round(finaleLift * Math.sqrt(height / (finaleHeight ?? finaleDefault)), 3)
    : liftTime(templateHeight, design.launch.time_s, height);
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
  const scale = sizeScale(mm);
  const templateReach = design.breaks[0].layers[0].radius_m;
  const radiusScale = scale * finaleRatio(segment.numbers.HTM, mm * FINALE_HEIGHT_M_PER_MM);
  scaleLayers(design, radiusScale, scale);
  const reach = round(templateReach * radiusScale, 1);
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
  const height = round(
    comets.height_m * sizeScale(mm) * finaleRatio(segment.numbers.HTM, mm * FINALE_HEIGHT_M_PER_MM),
    1,
  );
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
  const height = round(
    tourbillon.height_m *
      sizeScale(mm) *
      finaleRatio(segment.numbers.HTM, mm * FINALE_HEIGHT_M_PER_MM),
    1,
  );
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
  if (shellSegments.length) fireworks.push(shellFirework(shellSegments, tailSegments, context));
  else if (tailSegments.length)
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
