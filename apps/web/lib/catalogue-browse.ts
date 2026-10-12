/**
 * Pure filtering, sorting and facet helpers for the public catalogue.
 *
 * Kept free of React and server imports so the browse rules can be unit tested
 * and reused by the grid, the detail page and future catalogue surfaces.
 */

import type { FireworkSpecification } from './show-domain';

export type CatalogueBrowseProduct = Pick<
  FireworkSpecification,
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'durationSeconds'
  | 'heightMeters'
  | 'caliber'
  | 'shotCount'
  | 'manufacturer'
  | 'minPriceCents'
  | 'baseEffect'
  | 'variant'
>;

export const CATALOGUE_SORT_OPTIONS = [
  { value: 'name', label: 'Name A to Z' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
  { value: 'duration-desc', label: 'Longest first' },
  { value: 'height-desc', label: 'Tallest first' },
  { value: 'shots-desc', label: 'Most shots' },
] as const;

export type CatalogueSort = (typeof CATALOGUE_SORT_OPTIONS)[number]['value'];

const COLOUR_FAMILIES = [
  { value: 'red', label: 'Red', swatch: '#e5383b' },
  { value: 'orange', label: 'Orange', swatch: '#f77f00' },
  { value: 'gold', label: 'Gold', swatch: '#f4c430' },
  { value: 'green', label: 'Green', swatch: '#2dc653' },
  { value: 'blue', label: 'Blue', swatch: '#3a86ff' },
  { value: 'purple', label: 'Purple', swatch: '#9d4edd' },
  { value: 'pink', label: 'Pink', swatch: '#ff5d8f' },
  { value: 'white', label: 'White and silver', swatch: '#e9ecef' },
] as const;

export type ColourFamily = (typeof COLOUR_FAMILIES)[number]['value'];

export type CatalogueFilters = {
  query: string;
  kind: string;
  manufacturer: string;
  durationMin: number | null;
  durationMax: number | null;
  effect: string;
  caliber: string;
  colour: string;
  priceMaxCents: number | null;
  sort: CatalogueSort;
};

export type CatalogueSearchParams = {
  q?: string;
  kind?: string;
  manufacturer?: string;
  duration_min?: string;
  duration_max?: string;
  effect?: string;
  caliber?: string;
  colour?: string;
  price_max?: string;
  sort?: string;
  page?: string;
};

function parseNonNegative(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isSort(value: string | undefined): value is CatalogueSort {
  return CATALOGUE_SORT_OPTIONS.some((option) => option.value === value);
}

export function parseCatalogueFilters(params: CatalogueSearchParams): CatalogueFilters {
  const priceMax = parseNonNegative(params.price_max);
  return {
    query: params.q ?? '',
    kind: params.kind ?? '',
    manufacturer: params.manufacturer ?? '',
    durationMin: parseNonNegative(params.duration_min),
    durationMax: parseNonNegative(params.duration_max),
    effect: params.effect ?? '',
    caliber: params.caliber ?? '',
    colour: params.colour ?? '',
    priceMaxCents: priceMax == null ? null : Math.round(priceMax * 100),
    sort: isSort(params.sort) ? params.sort : 'name',
  };
}

/** Distinct hex colours for a product, primary first, capped for compact swatches. */
export function productColours(product: Pick<CatalogueBrowseProduct, 'variant'>, limit = 6) {
  const colours: string[] = [];
  const variant = product.variant;
  if (!variant) return colours;
  for (const colour of [variant.primaryColor, variant.secondaryColor, ...variant.colorPalette]) {
    if (!colour || !/^#[0-9a-f]{6}$/i.test(colour)) continue;
    const normalised = colour.toLowerCase();
    if (!colours.includes(normalised)) colours.push(normalised);
    if (colours.length >= limit) break;
  }
  return colours;
}

/** Buckets a hex colour into the family a shopper would search for. */
export function colourFamily(hex: string): ColourFamily | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return null;
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => Number.parseInt(part, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (saturation < 0.2 || lightness > 0.9) return 'white';

  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta + 6) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);

  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 38) return 'orange';
  if (hue < 70) return 'gold';
  if (hue < 165) return 'green';
  if (hue < 255) return 'blue';
  if (hue < 290) return 'purple';
  return 'pink';
}

export function productColourFamilies(product: Pick<CatalogueBrowseProduct, 'variant'>) {
  const families = new Set<ColourFamily>();
  for (const colour of productColours(product, 12)) {
    const family = colourFamily(colour);
    if (family) families.add(family);
  }
  return families;
}

export function colourFamilyLabel(value: string) {
  return COLOUR_FAMILIES.find((family) => family.value === value)?.label ?? value;
}

function matchesQuery(product: CatalogueBrowseProduct, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    product.name,
    product.description,
    product.slug,
    product.caliber,
    product.baseEffect?.name,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(q));
}

function matchesManufacturer(manufacturer: string | null | undefined, filter: string) {
  if (!filter) return true;
  if (filter === 'none') return manufacturer == null;
  return manufacturer === filter;
}

export function matchesCatalogueFilters(
  product: CatalogueBrowseProduct,
  filters: CatalogueFilters,
  ignore: ReadonlyArray<'effect' | 'caliber' | 'colour'> = [],
) {
  const shotCount = product.shotCount ?? 1;
  if (filters.kind === 'single' && shotCount > 1) return false;
  if (filters.kind === 'multishot' && shotCount <= 1) return false;
  if (!matchesManufacturer(product.manufacturer, filters.manufacturer)) return false;

  const duration = product.durationSeconds;
  if (filters.durationMin != null && (duration == null || duration < filters.durationMin))
    return false;
  if (filters.durationMax != null && (duration == null || duration > filters.durationMax))
    return false;

  if (
    filters.priceMaxCents != null &&
    (product.minPriceCents == null || product.minPriceCents > filters.priceMaxCents)
  )
    return false;

  if (filters.effect && !ignore.includes('effect') && product.baseEffect?.slug !== filters.effect)
    return false;
  if (filters.caliber && !ignore.includes('caliber') && product.caliber !== filters.caliber)
    return false;
  if (
    filters.colour &&
    !ignore.includes('colour') &&
    !productColourFamilies(product).has(filters.colour as ColourFamily)
  )
    return false;

  return matchesQuery(product, filters.query);
}

function compareNullableDesc(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function compareNullableAsc(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

/** Stable sort; unknown values always sink to the end. */
export function sortCatalogueProducts<T extends CatalogueBrowseProduct>(
  products: readonly T[],
  sort: CatalogueSort,
): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const compare: Record<CatalogueSort, (a: T, b: T) => number> = {
    name: byName,
    'price-asc': (a, b) => compareNullableAsc(a.minPriceCents, b.minPriceCents) || byName(a, b),
    'price-desc': (a, b) => compareNullableDesc(a.minPriceCents, b.minPriceCents) || byName(a, b),
    'duration-desc': (a, b) =>
      compareNullableDesc(a.durationSeconds, b.durationSeconds) || byName(a, b),
    'height-desc': (a, b) => compareNullableDesc(a.heightMeters, b.heightMeters) || byName(a, b),
    'shots-desc': (a, b) => (b.shotCount ?? 1) - (a.shotCount ?? 1) || byName(a, b),
  };
  return [...products].sort(compare[sort]);
}

export type CatalogueFacet = { value: string; label: string; count: number };

function countFacet(values: Iterable<{ value: string; label: string }>) {
  const counts = new Map<string, CatalogueFacet>();
  for (const { value, label } of values) {
    const existing = counts.get(value);
    if (existing) existing.count += 1;
    else counts.set(value, { value, label, count: 1 });
  }
  return [...counts.values()];
}

function caliberSortKey(caliber: string) {
  const numeric = Number.parseFloat(caliber);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

/**
 * Facet counts for the effect, calibre and colour pickers. Each facet ignores
 * its own selection so the other choices in that group stay visible.
 */
export function catalogueFacets(
  products: readonly CatalogueBrowseProduct[],
  filters: CatalogueFilters,
) {
  const effects = countFacet(
    products
      .filter((product) => matchesCatalogueFilters(product, filters, ['effect']))
      .flatMap((product) =>
        product.baseEffect
          ? [{ value: product.baseEffect.slug, label: product.baseEffect.name }]
          : [],
      ),
  ).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const calibers = countFacet(
    products
      .filter((product) => matchesCatalogueFilters(product, filters, ['caliber']))
      .flatMap((product) =>
        product.caliber ? [{ value: product.caliber, label: product.caliber }] : [],
      ),
  ).sort(
    (a, b) => caliberSortKey(a.value) - caliberSortKey(b.value) || a.label.localeCompare(b.label),
  );

  const colourCounts = new Map<string, number>();
  for (const product of products) {
    if (!matchesCatalogueFilters(product, filters, ['colour'])) continue;
    for (const family of productColourFamilies(product)) {
      colourCounts.set(family, (colourCounts.get(family) ?? 0) + 1);
    }
  }
  const colours = COLOUR_FAMILIES.filter((family) => colourCounts.has(family.value)).map(
    (family) => ({
      value: family.value,
      label: family.label,
      swatch: family.swatch,
      count: colourCounts.get(family.value) ?? 0,
    }),
  );

  return { effects, calibers, colours };
}

/**
 * Related products for the detail page: same effect first, then shared colour
 * families, then the same calibre.
 */
export function relatedCatalogueProducts<T extends CatalogueBrowseProduct>(
  product: CatalogueBrowseProduct,
  products: readonly T[],
  limit = 4,
): T[] {
  const families = productColourFamilies(product);
  const scored = products
    .filter((candidate) => candidate.id !== product.id)
    .map((candidate) => {
      let score = 0;
      if (product.baseEffect && candidate.baseEffect?.slug === product.baseEffect.slug) score += 4;
      for (const family of productColourFamilies(candidate)) if (families.has(family)) score += 1;
      if (product.caliber && candidate.caliber === product.caliber) score += 1;
      if ((candidate.shotCount ?? 1) > 1 === (product.shotCount ?? 1) > 1) score += 1;
      return { candidate, score };
    })
    .filter(({ score }) => score > 1)
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));
  return scored.slice(0, limit).map(({ candidate }) => candidate);
}

/** URL for the catalogue with one parameter changed and paging reset. */
export function catalogueHref(
  current: CatalogueSearchParams,
  changes: Partial<Record<keyof CatalogueSearchParams, string | null>>,
) {
  const params = new URLSearchParams();
  const merged: Record<string, string | null | undefined> = { ...current, ...changes };
  delete merged.page;
  if ('page' in changes) merged.page = changes.page;
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/catalogue?${query}` : '/catalogue';
}

function listWords(words: string[]) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/**
 * Plain-English one-liner for a product. Imported descriptions are often raw
 * supplier codes, so the page leads with this and tucks the original away.
 */
export function catalogueProductSummary(
  product: Pick<CatalogueBrowseProduct, 'shotCount' | 'caliber' | 'baseEffect' | 'variant'>,
) {
  const shots = product.shotCount ?? 1;
  const effect = product.baseEffect?.name.toLowerCase() ?? 'firework';
  const colours = [...productColourFamilies(product)].map((family) =>
    family === 'white' ? 'silver' : family,
  );
  const shape = shots > 1 ? `${shots}-shot ${effect} cake` : `single ${effect} shell`;
  const article = /^[aeiou8]/i.test(shape) ? 'An' : 'A';
  const calibre = product.caliber ? ` in ${product.caliber}` : '';
  const colourText = colours.length ? `, firing ${listWords(colours)}` : '';
  return `${article} ${shape}${calibre}${colourText}.`;
}

/** Supplier text that is short prose rather than a dump of shot codes. */
export function isReadableDescription(description: string | null | undefined) {
  if (!description) return false;
  return description.length <= 180 && !/\(\s*[0-9a-f]{3,}\//i.test(description);
}
