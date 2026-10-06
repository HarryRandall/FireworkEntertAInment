import { createHash } from 'node:crypto';

/** Highest priority first. Explicit product names outrank description and legacy hints. */
export const MATCH_RULES = [
  [/crackl.*palm|palm.*crackl/i, ['crackPalm']],
  [/crackl.*c[hry]+santhemum|c[hry]+santhemum.*crackl/i, ['crackleChrys']],
  [/glitter.*brocade|brocade.*glitter/i, ['brocade']],
  [/glitter.*willow|willow.*glitter/i, ['glitterWillow']],
  [/strobe.*pistil|pistil.*strobe/i, ['strobePistil']],
  [/dahlia.*strobe|strobe.*dahlia/i, ['dahliaStrobe']],
  [/crackl.*mine|mine.*crackl/i, ['crackleMine']],
  [/glitter.*mine|mine.*glitter/i, ['glitterMine']],
  [/silver.*mine/i, ['silverMine']],
  [/silver.*fountain/i, ['silverFountain']],
  [/spray.*fountain/i, ['sprayFountain']],
  [/comet.*crossette/i, ['cometCrossette']],
  [/silver.*c[hry]+santhemum/i, ['silverChrys']],
  [/brocade.*\bto\b/i, ['brocadeTips']],
  [/willow/i, ['willow', 'greenWillow']],
  [/horsetail/i, ['horsetail']],
  [/nishiki/i, ['nishiki']],
  [/kamuro/i, ['kamuro', 'silverKamuro']],
  [/brocade/i, ['brocade']],
  [/palm/i, ['palm']],
  [/crossette/i, ['crossette', 'redCrossette']],
  [/c[hry]+santhemum/i, ['chrysanthemum', 'silverChrys']],
  [/peony/i, ['peony', 'peonyRedGreen']],
  [/pistil/i, ['pistil', 'purplePistil']],
  [/strob/i, ['strobe', 'greenStrobe']],
  [/crackl/i, ['crackle']],
  [/double.*break|multi.*break/i, ['multiBreak']],
  [/roman.*candle/i, ['romanCandle']],
  [/silver.*fish|\bfish\b/i, ['fish']],
  [/bow.*tie/i, ['bowtie']],
  [/five.*point.*star/i, ['fivePointStar']],
  [/saturn/i, ['saturn']],
  [/waterfall/i, ['waterfall']],
  [/whirl/i, ['whirlwind']],
  [/pearls/i, ['pearls']],
  [/ring/i, ['ring']],
  [/comet/i, ['comet']],
  [/mine/i, ['mine']],
  [/fountain/i, ['fountain', 'silverFountain']],
];

/** Ties use the least-used equally suitable template, then table order. */
export function matchTemplate(firework, effect, usage = new Map()) {
  const old = firework.render_snapshot_json ?? firework.render_overrides_json ?? {};
  const hints = [
    ['name', firework.name ?? ''],
    ['description', firework.description ?? ''],
    ['base effect', effect.pattern_key.replaceAll('_', ' ')],
    [
      'legacy behaviour',
      [
        old.shellType,
        old.geometry,
        old.strobe?.enabled ? 'strobe' : '',
        old.crackle?.enabled ? 'crackle' : '',
        effect.model_json?.geometry,
      ]
        .filter(Boolean)
        .join(' '),
    ],
  ];
  // Compound matches may draw their qualifier from the description, but only
  // when the named family occurs in the name (e.g. Chrysanthemum with crackle).
  const compound = MATCH_RULES.slice(0, 14).find(
    ([rule]) =>
      rule.test(hints[0][1]) ||
      (rule.test(`${hints[0][1]} ${hints[1][1]}`) &&
        /palm|c[hry]+santhemum|brocade|willow|pistil|dahlia|mine|fountain|crossette/i.test(
          hints[0][1],
        )),
  );
  const found = compound
    ? ['name and description', compound]
    : hints
        .map(([source, text]) => [source, MATCH_RULES.find(([rule]) => rule.test(text))])
        .find(([, rule]) => rule);
  if (!found) throw new Error(`No template match for ${firework.slug}`);
  const [source, [rule, candidates]] = found;
  const key = [...candidates].sort((a, b) => (usage.get(a) ?? 0) - (usage.get(b) ?? 0))[0];
  usage.set(key, (usage.get(key) ?? 0) + 1);
  return {
    key,
    reason: `${source}: ${rule.source}; equally suitable candidates: ${candidates.join(', ')}; least-used tie break.`,
  };
}

/** Substitute colour identities globally, retaining layer/stop relationships and modes.
 * Metallic trails, flashes and all other authored parameters remain unchanged. */
export function catalogueDesign(templateDesign, firework) {
  const design = structuredClone(templateDesign);
  design.seed = createHash('sha256').update(`catalogue:${firework.slug}`).digest().readUInt32BE(0);
  const palette = [
    ...new Set(
      [firework.primary_color, ...(firework.color_palette ?? []), firework.secondary_color].filter(
        Boolean,
      ),
    ),
  ];
  const controls = design.breaks.flatMap((burst) => burst.layers.map((layer) => layer.colour));
  for (const part of Object.values(design.ground ?? {})) {
    if (part && typeof part === 'object' && part.colour) controls.push(part.colour);
  }
  const identities = [
    ...new Set(
      controls.flatMap((control) =>
        typeof control === 'string' ? [control] : control.stops.flatMap(([, colours]) => colours),
      ),
    ),
  ];
  const mapped = new Map(
    identities.map((colour, index) => [colour, palette[index % palette.length]]),
  );
  if (palette.length) {
    for (const control of controls.filter((control) => typeof control !== 'string')) {
      control.stops = control.stops.map(([at, colours]) => [
        at,
        Array.isArray(colours) ? colours.map((colour) => mapped.get(colour)) : mapped.get(colours),
      ]);
    }
    for (const part of Object.values(design.ground ?? {})) {
      if (part && typeof part === 'object' && typeof part.colour === 'string')
        part.colour = mapped.get(part.colour);
    }
  }
  return design;
}

/** Stable catalogue spelling for renderer keys, including camelCase keys. */
export function templateSlug(key) {
  return `renderer-${key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replaceAll('_', '-')}`;
}
