/** Finale VDL words and what each one does to a renderer design. Rows are data so admins can retune them. */
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const tails = [
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
] as const;
const tail = z.enum(tails);
export type VdlTail = z.infer<typeof tail>;

const modifier = z
  .object({
    kind: z.enum([
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
    ]),
    at: z.number().min(0).max(1).optional(),
    rate_hz: z.number().min(0.001).max(500).optional(),
    count: z.number().int().min(1).max(400).optional(),
    amount: z.number().min(-20).max(20).optional(),
    spread: z.enum(['burst', 'continuous']).optional(),
  })
  .strict();
export type VdlModifier = z.infer<typeof modifier>;

const layerPatch = z
  .object({
    pattern: z.enum(['sphere', 'ring', 'random', 'fan', 'cone', 'bottom']).optional(),
    speed_var: z.number().min(0).max(1).optional(),
    gravity_m_s2: z.number().min(-40).max(100).optional(),
    brightness: z.number().min(0).max(10).optional(),
    head_size: z.number().min(0).max(10).optional(),
    head_visible: z.boolean().optional(),
    trail_sparks: z.number().int().min(0).max(10000).optional(),
    trail_length_s: z.number().min(0.001).max(20).optional(),
    trail_colour: z.union([z.enum(['house', 'star']), hex]).optional(),
    trail_glitter: z.number().min(0).max(1).optional(),
  })
  .strict();
export type VdlLayerPatch = z.infer<typeof layerPatch>;

/** Families decide which firework a part becomes; a shell part adds a layer to the shot's shell. */
const VDL_FAMILIES = ['shell', 'mine', 'comet', 'tourbillon'] as const;
export type VdlFamily = (typeof VDL_FAMILIES)[number];

const VDL_ADJECTIVE_TARGETS = [
  'size',
  'stars',
  'burn',
  'brightness',
  'star_size',
  'trail.length',
  'trail.density',
  'trail.spray',
  'spread',
  'droop',
  'speed',
] as const;
export type VdlAdjectiveTarget = (typeof VDL_ADJECTIVE_TARGETS)[number];

/** One glossary meaning. `approximate` explains, in the preview, where the renderer cannot match Finale. */
export const vdlTermSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('effect'),
      template: z.string().min(1).max(80),
      family: z.enum(VDL_FAMILIES),
      layer: layerPatch.optional(),
      modifiers: z.array(modifier).max(4).optional(),
      tail: tail.optional(),
      approximate: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('device'),
      device: z.enum(['shell', 'mine', 'comet', 'tail', 'rising', 'bombette', 'pistil']),
      layer: layerPatch.optional(),
      approximate: z.string().max(200).optional(),
    })
    .strict(),
  z.object({ type: z.literal('colour'), colours: z.array(hex).min(1).max(8) }).strict(),
  z
    .object({ type: z.literal('trail-colour'), colour: hex, star: hex, tail: tail.optional() })
    .strict(),
  z.object({ type: z.literal('tip'), colour: hex }).strict(),
  z
    .object({
      type: z.literal('appearance'),
      modifiers: z.array(modifier).max(4).optional(),
      layer: layerPatch.optional(),
      tail: tail.optional(),
      sound: z.enum(['crackle', 'whistle']).optional(),
      approximate: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('adjective'),
      target: z.enum(VDL_ADJECTIVE_TARGETS),
      direction: z.union([z.literal(1), z.literal(-1)]),
      approximate: z.string().max(200).optional(),
    })
    .strict(),
  z.object({ type: z.literal('intensity'), level: z.number().int().min(1).max(3) }).strict(),
  z.object({ type: z.literal('connector'), connector: z.enum(['with', 'to', 'and']) }).strict(),
  z.object({ type: z.literal('ignore') }).strict(),
]);
export type VdlTerm = z.infer<typeof vdlTermSchema>;
export type VdlGlossary = ReadonlyMap<string, VdlTerm>;

/** Lower-case, single-spaced phrase used as the glossary key. */
export function glossaryPhrase(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

const effect = (
  template: string,
  extra: Omit<Extract<VdlTerm, { type: 'effect' }>, 'type' | 'template' | 'family'> & {
    family?: VdlFamily;
  } = {},
): VdlTerm => ({ type: 'effect', template, family: extra.family ?? 'shell', ...extra });
const colour = (...colours: string[]): VdlTerm => ({ type: 'colour', colours });
const adjective = (target: VdlAdjectiveTarget, direction: 1 | -1, approximate?: string): VdlTerm =>
  approximate === undefined
    ? { type: 'adjective', target, direction }
    : { type: 'adjective', target, direction, approximate };
const STROBE: VdlModifier = { kind: 'strobe', rate_hz: 9, at: 0.15 };
const RED = '#ff3048';
const ORANGE = '#ff8a2a';
const YELLOW = '#ffe14a';
const GREEN = '#2fe06a';
const BLUE = '#2a62ff';
const INDIGO = '#6a4aff';
const PURPLE = '#b04aff';
const VIOLET = '#c87aff';
const AQUA = '#3ad0ff';
const LIME = '#a8f03a';
const LAVENDER = '#b07aff';
const FRESH_YELLOW = '#fff07a';

/** Built-in vocabulary from Finale's VDL glossary, adjustment terms and colour pages. */
export const BUILT_IN_VDL_TERMS: Readonly<Record<string, VdlTerm>> = {
  // Structure.
  'w/': { type: 'connector', connector: 'with' },
  with: { type: 'connector', connector: 'with' },
  to: { type: 'connector', connector: 'to' },
  '&': { type: 'connector', connector: 'and' },
  and: { type: 'connector', connector: 'and' },
  slightly: { type: 'intensity', level: 1 },
  very: { type: 'intensity', level: 3 },
  mixed: { type: 'ignore' },
  trail: { type: 'ignore' },
  'same color': { type: 'ignore' },
  'same colour': { type: 'ignore' },
  // Supplier lines repeat "Tip" after a tip adjective ("Very Bright Tip"); the star is already described.
  tip: { type: 'ignore' },
  // Devices.
  shell: { type: 'device', device: 'shell' },
  aerial: { type: 'device', device: 'shell' },
  mine: { type: 'device', device: 'mine' },
  bouquet: { type: 'device', device: 'mine' },
  comet: { type: 'device', device: 'comet' },
  comets: { type: 'device', device: 'comet' },
  meteor: { type: 'device', device: 'comet', layer: { trail_sparks: 0 } },
  pearl: { type: 'device', device: 'comet', layer: { trail_sparks: 0 } },
  tail: { type: 'device', device: 'tail' },
  rising: { type: 'device', device: 'rising' },
  bombette: {
    type: 'device',
    device: 'bombette',
    approximate:
      'Bombettes split into plain stars; strobing or crackling on the pieces is not drawn.',
  },
  bombettes: { type: 'device', device: 'bombette' },
  pistil: { type: 'device', device: 'pistil' },
  core: { type: 'device', device: 'pistil' },
  // Break and device nouns.
  peony: effect('peony'),
  dahlia: effect('dahlia'),
  chrysanthemum: effect('chrysanthemum'),
  chrys: effect('chrysanthemum'),
  willow: effect('willow', { tail: 'willow' }),
  'strobing willow': effect('willow', {
    layer: { head_size: 0.6, brightness: 1 },
    modifiers: [STROBE],
    tail: 'strobe',
  }),
  brocade: effect('brocade', { tail: 'brocade' }),
  'brocade willow': effect('glitterWillow', { tail: 'brocade' }),
  kamuro: effect('kamuro', { tail: 'brocade' }),
  palm: effect('palm', { tail: 'comet' }),
  'palm dahlia': effect('palm', { layer: { head_size: 2 } }),
  coconut: effect('coconut'),
  coco: effect('coconut'),
  horsetail: effect('horsetail'),
  waterfall: effect('waterfall'),
  crown: effect('brocadeCrown'),
  crossette: effect('crossette'),
  ring: effect('ring'),
  rings: effect('rings'),
  'double ring': effect('doubleRing'),
  'double rings': effect('doubleRing'),
  heart: effect('heart'),
  bowtie: effect('bowtie'),
  spider: effect('spider'),
  saturn: effect('saturn'),
  'time rain': effect('timeRain'),
  'falling leaves': effect('fallingLeaves'),
  'tiger tail': effect('tigerTail', { tail: 'tiger' }),
  salute: effect('salute'),
  'shell of shells': effect('multiBreak', {
    approximate: 'Shell of shells is drawn as breaks one after another.',
  }),
  lace: effect('peony', {
    layer: { head_size: 0.5, brightness: 0.8, trail_sparks: 14, trail_colour: '#a05a1e' },
    modifiers: [{ kind: 'twinkle', rate_hz: 6, at: 0.35 }],
    approximate: 'Lace is approximated with small twinkling stars.',
  }),
  cycas: effect('palm', { approximate: 'Cycas is drawn as a palm.' }),
  // Finale draws each go getter as one bright self-propelled star climbing from the tube.
  'go getter': effect('whiteComet', {
    family: 'comet',
    layer: { trail_sparks: 0 },
    approximate: 'Go getters are drawn as single climbing stars without their wander.',
  }),
  'go getters': effect('whiteComet', {
    family: 'comet',
    layer: { trail_sparks: 0 },
    approximate: 'Go getters are drawn as single climbing stars without their wander.',
  }),
  whistles: effect('whistleCake', { family: 'comet', tail: 'whistle' }),
  whistle: effect('whistleCake', { family: 'comet', tail: 'whistle' }),
  whirls: effect('tourbillon', {
    family: 'tourbillon',
    tail: 'heli',
    approximate: 'Whirls are drawn as tourbillons.',
  }),
  tourbillions: effect('tourbillon', { family: 'tourbillon' }),
  fountain: effect('fountain'),
  // Appearance.
  strobing: { type: 'appearance', modifiers: [STROBE], tail: 'strobe' },
  strobe: { type: 'appearance', modifiers: [STROBE], tail: 'strobe' },
  flashing: { type: 'appearance', modifiers: [{ kind: 'strobe', rate_hz: 3.5, at: 0.15 }] },
  twinkling: { type: 'appearance', modifiers: [{ kind: 'twinkle', rate_hz: 4, at: 0.2 }] },
  shimmering: {
    type: 'appearance',
    modifiers: [{ kind: 'twinkle', rate_hz: 25, at: 0.1 }],
    approximate: 'Shimmering is drawn as very fast twinkling.',
  },
  glittering: { type: 'appearance', layer: { trail_glitter: 0.8 }, tail: 'glitter' },
  spangle: { type: 'appearance', layer: { trail_glitter: 0.8 }, tail: 'glitter' },
  crackling: {
    type: 'appearance',
    modifiers: [{ kind: 'crackle', at: 0.2, spread: 'continuous' }],
    tail: 'crackle',
    sound: 'crackle',
  },
  crackle: {
    type: 'appearance',
    modifiers: [{ kind: 'crackle', at: 0.2, spread: 'continuous' }],
    tail: 'crackle',
    sound: 'crackle',
  },
  sizzle: {
    type: 'appearance',
    modifiers: [{ kind: 'crackle', at: 0.2, spread: 'continuous' }],
    tail: 'crackle',
    sound: 'crackle',
    approximate: 'Sizzle is drawn as a fine continuous crackle.',
  },
  'tight crackling': {
    type: 'appearance',
    modifiers: [{ kind: 'crackle', at: 0.65, count: 16, spread: 'burst' }],
    tail: 'crackle',
    sound: 'crackle',
  },
  'tight crackle': {
    type: 'appearance',
    modifiers: [{ kind: 'crackle', at: 0.65, count: 16, spread: 'burst' }],
    sound: 'crackle',
  },
  'crackle flowers': {
    type: 'appearance',
    modifiers: [{ kind: 'crackle', at: 0.65, count: 16, spread: 'burst' }],
    sound: 'crackle',
  },
  'popcorn crackling': {
    type: 'appearance',
    modifiers: [{ kind: 'pop', at: 0.8, count: 10, amount: 1.3 }],
    layer: { brightness: 0.4 },
    sound: 'crackle',
    approximate: 'Popcorn crackle is drawn as popping stars.',
  },
  'popcorn crackle': {
    type: 'appearance',
    modifiers: [{ kind: 'pop', at: 0.8, count: 10, amount: 1.3 }],
    layer: { brightness: 0.4 },
    sound: 'crackle',
  },
  'chase crackling': {
    type: 'appearance',
    modifiers: [{ kind: 'crackle', at: 0.05, spread: 'continuous' }],
    sound: 'crackle',
  },
  ear: {
    type: 'appearance',
    layer: { pattern: 'cone' },
    approximate: 'Ear is drawn as a cone of stars.',
  },
  ghost: { type: 'appearance', modifiers: [{ kind: 'ghost', at: 0.7, amount: 0.5 }] },
  report: { type: 'appearance', modifiers: [{ kind: 'pop', at: 0.95, count: 12, amount: 2 }] },
  bees: { type: 'appearance', modifiers: [{ kind: 'bees', at: 0.2, amount: 1.8 }] },
  fish: { type: 'appearance', modifiers: [{ kind: 'fish', at: 0.3, amount: 3 }] },
  'flying fish': { type: 'appearance', modifiers: [{ kind: 'fish', at: 0.3, amount: 3 }] },
  'no trail': { type: 'appearance', layer: { trail_sparks: 0 }, tail: 'dark' },
  dark: { type: 'appearance', layer: { brightness: 0.05 } },
  // Adjustment words. Slightly, plain and Very give levels 1, 2 and 3.
  big: adjective('size', 1),
  small: adjective('size', -1),
  dense: adjective('stars', 1),
  sparse: adjective('stars', -1),
  long: adjective('burn', 1),
  short: adjective('burn', -1),
  bright: adjective('brightness', 1),
  dim: adjective('brightness', -1),
  'bright tip': adjective('star_size', 1, 'Tip brightness is drawn as star size.'),
  'dim tip': adjective('star_size', -1, 'Tip brightness is drawn as star size.'),
  'bright trail': adjective('trail.density', 1, 'Trail brightness is drawn as trail density.'),
  'dim trail': adjective('trail.density', -1, 'Trail brightness is drawn as trail density.'),
  'long trail': adjective('trail.length', 1),
  'short trail': adjective('trail.length', -1),
  thick: adjective('trail.density', 1),
  thin: adjective('trail.density', -1),
  'thick trail': adjective('trail.density', 1),
  'thin trail': adjective('trail.density', -1),
  fat: adjective('trail.spray', 1),
  skinny: adjective('trail.spray', -1),
  ragged: adjective('spread', 1),
  uniform: adjective('spread', -1),
  droopy: adjective('droop', 1),
  fast: adjective('speed', 1),
  slow: adjective('speed', -1),
  tight: adjective('spread', -1),
  // Colours (Finale's names; values tuned for the renderer).
  red: colour(RED),
  ruby: colour('#ff2a6a'),
  orange: colour(ORANGE),
  peach: colour('#ffb060'),
  yellow: colour(YELLOW),
  'fresh yellow': colour(FRESH_YELLOW),
  lemon: colour('#f4f04a'),
  green: colour(GREEN),
  'grass green': colour('#5ee03a'),
  lime: colour(LIME),
  blue: colour(BLUE),
  'sea blue': colour('#3a8aff'),
  'sky blue': colour('#5ab0ff'),
  aqua: colour(AQUA),
  turquoise: colour('#2ad8d0'),
  cyan: colour('#40e8ff'),
  indigo: colour(INDIGO),
  lavender: colour(LAVENDER),
  lilac: colour(LAVENDER),
  purple: colour(PURPLE),
  violet: colour(VIOLET),
  magenta: colour('#ff3ad8'),
  fuchsia: colour('#ff5ae0'),
  pink: colour('#ff7ac8'),
  plum: colour('#c03a8a'),
  white: colour('#ffffff'),
  'multi color': colour(RED, YELLOW, GREEN, ORANGE, PURPLE),
  'multi colour': colour(RED, YELLOW, GREEN, ORANGE, PURPLE),
  rainbow: colour(RED, ORANGE, YELLOW, GREEN, BLUE, INDIGO, VIOLET),
  'pastel colors': colour(AQUA, FRESH_YELLOW, LIME, ORANGE, LAVENDER),
  'pastel colours': colour(AQUA, FRESH_YELLOW, LIME, ORANGE, LAVENDER),
  // Spark colours set the trail and, with no other colour, the stars.
  silver: { type: 'trail-colour', colour: '#ffffff', star: '#eef2ff', tail: 'silver' },
  // Finale's gold sparks read cream-white at their heads with a pale gold streak.
  gold: { type: 'trail-colour', colour: '#ffdc9a', star: '#fff0cc', tail: 'gold' },
  // Finale draws charcoal as pale gold sparks over an amber trail, not the orange of its Tip colour.
  charcoal: { type: 'trail-colour', colour: '#ff9c40', star: '#ffd28a', tail: 'willow' },
  gamboge: { type: 'trail-colour', colour: '#ff5a0d', star: '#ff8a3a', tail: 'gold' },
  'gold tip': { type: 'tip', colour: '#ffd27a' },
  'silver tip': { type: 'tip', colour: '#eef2ff' },
  'charcoal tip': { type: 'tip', colour: '#ff9a4a' },
  'gamboge tip': { type: 'tip', colour: '#ff8a3a' },
};

/** Built-in terms overlaid with saved rows; a saved row replaces the built-in meaning of its phrase. */
export function vdlGlossary(
  rows: readonly { phrase: string; definition: VdlTerm }[] = [],
): VdlGlossary {
  const glossary = new Map<string, VdlTerm>(Object.entries(BUILT_IN_VDL_TERMS));
  for (const row of rows) glossary.set(glossaryPhrase(row.phrase), row.definition);
  return glossary;
}

/** Short, readable meaning for the word list page. */
export function describeVdlTerm(term: VdlTerm): string {
  switch (term.type) {
    case 'effect':
      return `${term.family} from ${term.template}`;
    case 'device':
      return `part type: ${term.device}`;
    case 'colour':
      return `colour ${term.colours.join(', ')}`;
    case 'trail-colour':
      return `trail colour ${term.colour}`;
    case 'tip':
      return `star tip ${term.colour}, no trail`;
    case 'appearance':
      return [
        ...(term.modifiers ?? []).map((modifier) => modifier.kind),
        ...(term.layer ? Object.keys(term.layer) : []),
        ...(term.tail ? [`${term.tail} tail`] : []),
      ].join(', ');
    case 'adjective':
      return `${term.direction > 0 ? 'more' : 'less'} ${term.target}`;
    case 'intensity':
      return `strength ${term.level}`;
    case 'connector':
      return `joins parts (${term.connector})`;
    default:
      return 'ignored';
  }
}
