import type { FireworkSpecification } from '@/lib/show-domain';

const COLOUR_ALIASES = {
  red: ['red', 'reds', 'crimson', 'scarlet'],
  green: ['green', 'greens', 'emerald', 'lime'],
  blue: ['blue', 'blues', 'azure', 'cyan', 'teal'],
  purple: ['purple', 'purples', 'violet', 'magenta'],
  gold: ['gold', 'golds', 'golden', 'amber'],
  white: ['white', 'whites', 'ice', 'ivory'],
  silver: ['silver', 'silvers'],
  orange: ['orange', 'oranges'],
  pink: ['pink', 'pinks', 'rose'],
} as const;

const EFFECT_ALIASES = {
  crackle: ['crackle', 'crackling'],
  strobe: ['strobe', 'strobing'],
  ring: ['ring', 'rings'],
  crossette: ['crossette', 'crossettes'],
  horsetail: ['horsetail', 'horsetails'],
  floral: ['floral', 'flower', 'flowers'],
  'falling leaves': ['falling leaves', 'falling leaf'],
  glitter: ['glitter', 'glittering'],
  willow: ['willow', 'willows'],
} as const;

export type ColourFamily = keyof typeof COLOUR_ALIASES;
export type EffectFamily = keyof typeof EFFECT_ALIASES;

export type PromptConstraints = {
  requiredColours: ColourFamily[];
  forbiddenColours: ColourFamily[];
  requestedEffects: EffectFamily[];
  forbiddenEffects: EffectFamily[];
  multishots: 'required' | 'forbidden' | 'allowed';
};

export type PromptConstraintViolation = {
  kind:
    | 'missing_colour'
    | 'missing_effect'
    | 'forbidden_colour'
    | 'forbidden_effect'
    | 'multishot_required'
    | 'multishot_forbidden';
  value: string;
};

/**
 * Parse enforceable catalogue constraints from the user's own brief. Negative
 * wording is evaluated before positive mentions so "no crackle" can never be
 * misread as a request for crackle.
 */
export function parsePromptConstraints(text: string): PromptConstraints {
  const normalised = normalise(text);
  const forbiddenColours = matchingNegatedFamilies(normalised, COLOUR_ALIASES);
  const forbiddenEffects = matchingNegatedFamilies(normalised, EFFECT_ALIASES);
  const requiredColours = matchingPositiveFamilies(
    normalised,
    COLOUR_ALIASES,
    new Set(forbiddenColours),
  );
  const requestedEffects = matchingPositiveFamilies(
    normalised,
    EFFECT_ALIASES,
    new Set(forbiddenEffects),
  );

  if (/\bpatriotic\b/.test(normalised)) {
    for (const colour of ['red', 'white', 'blue'] as const) {
      if (!forbiddenColours.includes(colour) && !requiredColours.includes(colour)) {
        requiredColours.push(colour);
      }
    }
  }

  const multishots = hasAny(normalised, [
    /\b(?:no|without|avoid|exclude|excluding)\s+(?:any\s+)?multi[ -]?shots?\b/,
    /\bsingle[ -]?shots?\s+only\b/,
    /\bonly\s+single[ -]?shots?\b/,
  ])
    ? 'forbidden'
    : hasAny(normalised, [
          /\bmulti[ -]?shots?\s+only\b/,
          /\bonly\s+multi[ -]?shots?\b/,
          /\b(?:all|every)\s+(?:firework|product|cue)s?\s+(?:must\s+be\s+)?multi[ -]?shots?\b/,
        ])
      ? 'required'
      : 'allowed';

  return {
    requiredColours,
    forbiddenColours,
    requestedEffects,
    forbiddenEffects,
    multishots,
  };
}

export function productMatchesPromptConstraints(
  product: FireworkSpecification,
  constraints: PromptConstraints,
): boolean {
  const isMultishot = (product.shotCount ?? 1) > 1;
  if (constraints.multishots === 'required' && !isMultishot) return false;
  if (constraints.multishots === 'forbidden' && isMultishot) return false;

  const colours = productColourFamilies(product);
  if (constraints.forbiddenColours.some((colour) => colours.has(colour))) return false;
  if (
    constraints.requiredColours.length > 0 &&
    !constraints.requiredColours.some((colour) => colours.has(colour))
  ) {
    return false;
  }

  const effects = productEffectFamilies(product);
  if (constraints.forbiddenEffects.some((effect) => effects.has(effect))) return false;
  return true;
}

export function validatePromptConstraints(params: {
  productIds: Iterable<string>;
  products: FireworkSpecification[];
  constraints: PromptConstraints;
}): PromptConstraintViolation[] {
  const { products, constraints } = params;
  const productById = new Map(products.map((product) => [product.id, product]));
  const selected = Array.from(params.productIds)
    .map((id) => productById.get(id))
    .filter((product): product is FireworkSpecification => product != null);
  const violations: PromptConstraintViolation[] = [];

  for (const colour of constraints.requiredColours) {
    if (!selected.some((product) => productColourFamilies(product).has(colour))) {
      violations.push({ kind: 'missing_colour', value: colour });
    }
  }
  for (const effect of constraints.requestedEffects) {
    if (!selected.some((product) => productEffectFamilies(product).has(effect))) {
      violations.push({ kind: 'missing_effect', value: effect });
    }
  }

  for (const product of selected) {
    const colours = productColourFamilies(product);
    const effects = productEffectFamilies(product);
    for (const colour of constraints.forbiddenColours) {
      if (colours.has(colour)) violations.push({ kind: 'forbidden_colour', value: colour });
    }
    for (const effect of constraints.forbiddenEffects) {
      if (effects.has(effect)) violations.push({ kind: 'forbidden_effect', value: effect });
    }
    const isMultishot = (product.shotCount ?? 1) > 1;
    if (constraints.multishots === 'required' && !isMultishot) {
      violations.push({ kind: 'multishot_required', value: product.id });
    }
    if (constraints.multishots === 'forbidden' && isMultishot) {
      violations.push({ kind: 'multishot_forbidden', value: product.id });
    }
  }

  return uniqueViolations(violations);
}

export function productColourFamilies(product: FireworkSpecification): Set<ColourFamily> {
  const values = [
    product.spec.color,
    ...(product.spec.colorPalette ?? []),
    product.variant?.primaryColor,
    product.variant?.secondaryColor,
    ...(product.variant?.colorPalette ?? []),
  ].filter((value): value is string => typeof value === 'string');
  const text = normalise(`${productSearchText(product)} ${values.join(' ')}`);
  const families = new Set(matchingPositiveFamilies(text, COLOUR_ALIASES, new Set()));
  for (const value of values) {
    const family = hexColourFamily(value);
    if (family) families.add(family);
  }
  return families;
}

export function productEffectFamilies(product: FireworkSpecification): Set<EffectFamily> {
  const effects = new Set<EffectFamily>();
  if (product.spec.crackle) effects.add('crackle');
  if (product.spec.strobe) effects.add('strobe');
  if (product.spec.ring) effects.add('ring');
  if (product.spec.crossette) effects.add('crossette');
  if (product.spec.horsetail) effects.add('horsetail');
  if (product.spec.floral) effects.add('floral');
  if (product.spec.fallingLeaves) effects.add('falling leaves');
  if (product.spec.glitter && product.spec.glitter !== 'none') effects.add('glitter');

  const text = normalise(productSearchText(product));
  for (const [family, aliases] of Object.entries(EFFECT_ALIASES) as Array<
    [EffectFamily, readonly string[]]
  >) {
    if (aliases.some((alias) => containsPhrase(text, alias))) effects.add(family);
  }
  return effects;
}

function matchingNegatedFamilies<T extends string>(
  text: string,
  aliasesByFamily: Record<T, readonly string[]>,
): T[] {
  const matched: T[] = [];
  for (const [family, aliases] of Object.entries(aliasesByFamily) as Array<
    [T, readonly string[]]
  >) {
    if (aliases.some((alias) => isNegated(text, alias))) matched.push(family);
  }
  return matched;
}

function matchingPositiveFamilies<T extends string>(
  text: string,
  aliasesByFamily: Record<T, readonly string[]>,
  excluded: Set<T>,
): T[] {
  const matched: T[] = [];
  for (const [family, aliases] of Object.entries(aliasesByFamily) as Array<
    [T, readonly string[]]
  >) {
    if (excluded.has(family)) continue;
    if (aliases.some((alias) => containsPhrase(text, alias) && !isNegated(text, alias))) {
      matched.push(family);
    }
  }
  return matched;
}

function isNegated(text: string, phrase: string): boolean {
  const escaped = escapeRegExp(phrase).replace(/\\ /g, '\\s+');
  return new RegExp(
    `\\b(?:no|not|without|avoid|avoiding|exclude|excluding|forbid|forbidden)\\s+(?:any\\s+)?${escaped}\\b`,
  ).test(text);
}

function containsPhrase(text: string, phrase: string): boolean {
  const escaped = escapeRegExp(phrase).replace(/\\ /g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

function productSearchText(product: FireworkSpecification): string {
  return [
    product.name,
    product.description,
    product.spec.color,
    ...(product.spec.colorPalette ?? []),
    product.variant?.primaryColor,
    product.variant?.secondaryColor,
    ...(product.variant?.colorPalette ?? []),
    product.baseEffect?.name,
    product.baseEffect?.patternKey,
  ]
    .filter(Boolean)
    .join(' ');
}

function hexColourFamily(value: string): ColourFamily | null {
  const hex = value.trim().match(/^#?([0-9a-f]{6})$/i)?.[1];
  if (!hex) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta < 0.12) return lightness >= 0.82 ? 'white' : lightness >= 0.38 ? 'silver' : null;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / delta + 2) * 60;
  else hue = ((r - g) / delta + 4) * 60;
  if (hue < 18 || hue >= 345) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 70) return 'gold';
  if (hue < 165) return 'green';
  if (hue < 255) return 'blue';
  if (hue < 300) return 'purple';
  return 'pink';
}

function uniqueViolations(violations: PromptConstraintViolation[]): PromptConstraintViolation[] {
  const seen = new Set<string>();
  return violations.filter((violation) => {
    const key = `${violation.kind}:${violation.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
