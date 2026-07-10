import type { ShowTemplate, ShowTemplateCue } from '@/lib/admin.types';
import { shaderCoverFromSeed } from '@/lib/shader-cover';

type LibrarySeedSection = {
  key: 'featured' | 'popular' | 'hot' | 'recent' | 'shortest';
  label: string;
  phrase: string;
  sortBase: number;
  isFeatured: boolean;
  prefixes: string[];
  suffixes: string[];
  themes: string[];
  fireworkSlugs: string[];
};

const SEED_BASE_TIME = Date.UTC(2026, 5, 29, 12, 0, 0);

const LIBRARY_SEED_SECTIONS: LibrarySeedSection[] = [
  {
    key: 'featured',
    label: 'Staff picks',
    phrase: 'curated staff-pick',
    sortBase: 2000,
    isFeatured: true,
    prefixes: [
      'Starlight',
      'Velvet',
      'Glass Sky',
      'Moonlit',
      'Halo',
      'Silver',
      'Prism',
      'Northern',
      'Opal',
      'Celestial',
    ],
    suffixes: ['Harbour', 'Crown', 'Overture'],
    themes: [
      'polished silver palms with blue accents',
      'premium halo bursts and soft strobes',
      'cinematic comets with a broad finale',
      'elegant willows with crisp white lifts',
      'layered rings and sapphire trails',
    ],
    fireworkSlugs: [
      'palm-default',
      'kamuro-default',
      'ring-azure',
      'strobe-default',
      'brocade-default',
      'willow-default',
      'peony-azure',
      'double_break-default',
    ],
  },
  {
    key: 'popular',
    label: 'Popular this month',
    phrase: 'crowd favourite',
    sortBase: 3000,
    isFeatured: false,
    prefixes: [
      'Crowd',
      'Stadium',
      'Festival',
      'Balcony',
      'Summer',
      'Rooftop',
      'Night Market',
      'Coastline',
      'Fireline',
      'Electric',
    ],
    suffixes: ['Chorus', 'Bloom', 'Relay'],
    themes: [
      'crowd-friendly peonies with bright rings',
      'festival colour hits and tidy mines',
      'open-air palms with a pop finish',
      'family-friendly bursts and blue returns',
      'cheerful red and gold transitions',
    ],
    fireworkSlugs: [
      'peony-crimson',
      'ring-azure',
      'chrysanthemum-default',
      'crossette-default',
      'mine-default',
      'palm-default',
      'strobe-default',
      'peony-azure',
    ],
  },
  {
    key: 'hot',
    label: 'Hot right now',
    phrase: 'high-energy',
    sortBase: 4000,
    isFeatured: false,
    prefixes: [
      'Ignition',
      'Voltage',
      'Redline',
      'Afterburn',
      'Thunder',
      'Pulse',
      'Shockwave',
      'Nitro',
      'Bassline',
      'Skyline',
    ],
    suffixes: ['Rush', 'Wave', 'Barrage'],
    themes: [
      'fast crimson mines with white strobe hits',
      'dense crossettes and tight finale timing',
      'loud crackle lines with red peonies',
      'rapid comet runs and bold ring accents',
      'heavy mines with quick colour changes',
    ],
    fireworkSlugs: [
      'mine-default',
      'crackle-crimson',
      'crossette-crimson',
      'strobe-crimson',
      'comet-crimson',
      'ring-crimson',
      'peony-crimson',
      'whirl-azure',
    ],
  },
  {
    key: 'recent',
    label: 'Fresh drops',
    phrase: 'freshly published',
    sortBase: 5000,
    isFeatured: false,
    prefixes: [
      'Fresh',
      'New Moon',
      'First Light',
      'Tomorrow',
      'Soft Launch',
      'Modern',
      'Rain Glass',
      'Blue Draft',
      'Orchard',
      'Crescent',
    ],
    suffixes: ['Horizon', 'Garden', 'Circuit'],
    themes: [
      'fresh cyan trails with soft willow lifts',
      'new blue peonies and calm silver falls',
      'clean comet timing with gentle rings',
      'modern pastel colour and low noise',
      'soft garden breaks with bright edges',
    ],
    fireworkSlugs: [
      'comet-azure',
      'pearls-default',
      'willow-default',
      'ring-default',
      'pistil-azure',
      'peony-default',
      'waterfall-azure',
      'nishiki-default',
    ],
  },
  {
    key: 'shortest',
    label: 'Quick bursts',
    phrase: 'quick burst',
    sortBase: 6000,
    isFeatured: false,
    prefixes: [
      'Spark',
      'Tiny',
      'One-Minute',
      'Quick',
      'Flash',
      'Pocket',
      'Ten Beat',
      'Micro',
      'Short Fuse',
      'Mini',
    ],
    suffixes: ['Shot', 'Crown', 'Bloom'],
    themes: [
      'compact comet hits with a neat finale',
      'short peonies and clean mine accents',
      'quick rings for brief music clips',
      'small-yard timing with bright colour',
      'tiny palms and fast silver shimmer',
    ],
    fireworkSlugs: [
      'comet-default',
      'mine-default',
      'ring-default',
      'pearls-default',
      'peony-azure',
      'strobe-default',
      'crossette-default',
      'whirl-azure',
    ],
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function durationFor(section: LibrarySeedSection, item: number): number {
  if (section.key === 'featured') return 150 + ((item - 1) % 7) * 15;
  if (section.key === 'popular') return 120 + ((item - 1) % 8) * 12;
  if (section.key === 'hot') return 75 + ((item - 1) % 8) * 10;
  if (section.key === 'recent') return 105 + ((item - 1) % 7) * 12;
  return 45 + ((item - 1) % 6) * 10;
}

function effectsFor(section: LibrarySeedSection, item: number): number {
  if (section.key === 'featured') return 22 + ((item - 1) % 9);
  if (section.key === 'popular') return 18 + ((item - 1) % 8);
  if (section.key === 'hot') return 20 + ((item - 1) % 9);
  if (section.key === 'recent') return 14 + ((item - 1) % 8);
  return 8 + ((item - 1) % 6);
}

function budgetFor(section: LibrarySeedSection, item: number): number {
  if (section.key === 'featured') return 16000 + item * 430;
  if (section.key === 'popular') return 9500 + item * 260;
  if (section.key === 'hot') return 8500 + item * 240;
  if (section.key === 'recent') return 8000 + item * 210;
  return 3800 + item * 120;
}

function likeCountFor(section: LibrarySeedSection, item: number): number {
  if (section.key === 'popular') return 1650 - item * 9;
  if (section.key === 'featured') return 1320 - item * 7;
  if (section.key === 'hot') return 1180 - item * 5;
  if (section.key === 'recent') return 860 - item * 4;
  return 520 - item * 3;
}

function updatedAtFor(section: LibrarySeedSection, item: number): string {
  const baseHours =
    section.key === 'recent'
      ? 0
      : section.key === 'hot'
        ? 96
        : section.key === 'popular'
          ? 192
          : section.key === 'featured'
            ? 288
            : 384;
  return new Date(SEED_BASE_TIME - (baseHours + item) * 60 * 60 * 1000).toISOString();
}

function buildPreviewCues(
  fireworkSlugs: string[],
  durationSeconds: number,
  effectsCount: number,
): ShowTemplateCue[] {
  return Array.from({ length: effectsCount }, (_, index) => {
    const cueIndex = index + 1;
    const fireworkSlug = fireworkSlugs[index % fireworkSlugs.length]!;
    return {
      timeSeconds: Math.max(2, Math.floor((durationSeconds / (effectsCount + 1)) * cueIndex)),
      fireworkSlug,
      description: `${fireworkSlug.split('-')[0]?.replace(/_/g, ' ') ?? 'Firework'} cue`,
      catalogueItemId: null,
      catalogueItemSlug: null,
      launchPositionIndex: index % 3,
      emphasis: cueIndex === effectsCount ? 'peak' : cueIndex % 4 === 0 ? 'accent' : 'normal',
    };
  });
}

function buildSeedTemplate(section: LibrarySeedSection, index: number): ShowTemplate {
  const item = index + 1;
  const prefix = section.prefixes[index % section.prefixes.length]!;
  const suffix = section.suffixes[Math.floor(index / section.prefixes.length)]!;
  const title = `${prefix} ${suffix}`;
  const slug = `library-${section.key}-${String(item).padStart(2, '0')}-${slugify(title)}`;
  const theme = section.themes[index % section.themes.length]!;
  const durationSeconds = durationFor(section, item);
  const effectsCount = effectsFor(section, item);
  const budgetCents = budgetFor(section, item);
  const createdAt = new Date(
    SEED_BASE_TIME - (section.sortBase + item) * 60 * 60 * 1000,
  ).toISOString();
  const updatedAt = updatedAtFor(section, item);

  return {
    id: `seed-${section.key}-${String(item).padStart(2, '0')}`,
    slug,
    title,
    theme,
    description: `A ${section.phrase} library show with ${theme}. Built for quick browsing, preview playback and cloning.`,
    durationSeconds,
    budgetCents,
    totalCents: Math.round(budgetCents * (0.74 + (item % 6) * 0.025)),
    effectsCount,
    timeOfDay:
      (section.key === 'recent' && item % 3 === 0) || (section.key === 'shortest' && item % 2 === 0)
        ? 'Dusk'
        : 'Night',
    moodTags: [
      section.label,
      ['Colourful', 'Elegant', 'High energy', 'Cinematic', 'Family friendly'][index % 5]!,
      durationSeconds <= 75 ? 'Short' : budgetCents >= 18000 ? 'Premium' : 'Preview ready',
    ],
    previewCues: buildPreviewCues(section.fireworkSlugs, durationSeconds, effectsCount),
    coverShader: shaderCoverFromSeed(slug),
    coverImagePath: null,
    isFeatured: section.isFeatured,
    isPublished: true,
    publishedAt: createdAt,
    sortOrder: section.sortBase + item,
    likeCount: likeCountFor(section, item),
    createdAt,
    updatedAt,
  };
}

export const SEEDED_LIBRARY_TEMPLATES: ShowTemplate[] = LIBRARY_SEED_SECTIONS.flatMap((section) =>
  Array.from({ length: 30 }, (_, index) => buildSeedTemplate(section, index)),
);

export function mergeSeededLibraryTemplates(templates: ShowTemplate[]): ShowTemplate[] {
  const existingSlugs = new Set(templates.map((template) => template.slug));
  const missingSeeds = SEEDED_LIBRARY_TEMPLATES.filter(
    (template) => !existingSlugs.has(template.slug),
  );
  return [...templates, ...missingSeeds];
}
