import type { Show } from '@/lib/show-domain';
import type { ShowTemplate } from '@/lib/admin.types';
import type { ShowCover } from '@/lib/cover';

export type VisualPalette = {
  names: [string, string, string];
  hex: [string, string, string];
};

export type ShowSummaryCard = {
  id: string;
  slug: string;
  title: string;
  songTitle: string | null;
  artist: string | null;
  style: string;
  lengthSeconds: number | null;
  cueCount: number;
  totalCostCents: number;
  lastEditedAt: string;
  palette: VisualPalette;
  energySeries: number[];
  coverShader: ShowCover | null;
  coverImagePath: string | null;
};

export type TemplateSummaryCard = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  lengthSeconds: number | null;
  cueCount: number;
  totalCostCents: number;
  likes: number;
  isFeatured: boolean;
  palette: VisualPalette;
  energySeries: number[];
};

export type WorkspaceSummary = {
  showCount: number;
  totalRuntimeSeconds: number;
  totalCatalogueValueCents: number;
  recentShows: ShowSummaryCard[];
};

/** Sidebar-sized AI credit usage subset. The full `AiCreditSummary` adds cost
 * definitions and recent transactions that the shell does not need, so the
 * `/api/me/summary` payload ships only these fields to the client. */
export type AiUsageSummary = {
  balance: number;
  reserved: number;
  available: number;
  includedCredits: number;
  hourlyLimit: number;
  weeklyLimit: number;
  hourlyUsed: number;
  weeklyUsed: number;
  hourlyRemaining: number;
  weeklyRemaining: number;
  totalGranted: number;
  totalSpent: number;
};

export type DashboardSummary = WorkspaceSummary & {
  allShows: ShowSummaryCard[];
  communityTemplates: TemplateSummaryCard[];
};

export const PALETTE_HEX: Record<string, string> = {
  gold: '#EFB93F',
  silver: '#C9CDD3',
  emerald: '#2EC487',
  red: '#E24B4A',
  blue: '#4D9FE8',
  purple: '#8F7BE8',
  pink: '#E86FA0',
  white: '#F4F1EA',
  green: '#7BC850',
  orange: '#F08A3C',
  teal: '#3FC4B0',
};

const PALETTE_NAMES = Object.keys(PALETTE_HEX);

function hashString(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickPaletteNames(seed: string): [string, string, string] {
  const hash = hashString(seed);
  const names: string[] = [];
  for (let offset = 0; names.length < 3; offset += 1) {
    const next = PALETTE_NAMES[(hash + offset * 7 + names.length * 11) % PALETTE_NAMES.length];
    if (!names.includes(next)) names.push(next);
  }
  return [names[0] ?? 'silver', names[1] ?? 'blue', names[2] ?? 'emerald'];
}

export function buildVisualPalette(seed: string): VisualPalette {
  const names = pickPaletteNames(seed || 'showcrafter');
  return {
    names,
    hex: [
      PALETTE_HEX[names[0]] ?? PALETTE_HEX.silver,
      PALETTE_HEX[names[1]] ?? PALETTE_HEX.silver,
      PALETTE_HEX[names[2]] ?? PALETTE_HEX.silver,
    ],
  };
}

export function buildEnergySeries(seed: string, cueCount: number, buckets = 48): number[] {
  const hash = hashString(seed || 'showcrafter');
  const phase = (hash % 360) * (Math.PI / 180);
  const density = Math.min(0.36, Math.max(0.06, cueCount / 180));

  return Array.from({ length: buckets }, (_, index) => {
    const progress = buckets <= 1 ? 1 : index / (buckets - 1);
    const wave = (Math.sin(progress * Math.PI * 3 + phase) + 1) / 2;
    const micro = ((hash >>> (index % 16)) & 7) / 28;
    const finaleLift = progress > 0.78 ? (progress - 0.78) * 1.35 : 0;
    const value = 0.14 + progress * 0.22 + wave * 0.34 + micro + density + finaleLift;
    return Math.max(0.08, Math.min(1, Number(value.toFixed(3))));
  });
}

function styleForShow(show: Show): string {
  const tag = show.moodTags.find(Boolean);
  if (tag) return tag.toLowerCase();
  if (show.timeOfDay) return show.timeOfDay.toLowerCase();
  return 'custom';
}

export function mapShowToSummary(show: Show): ShowSummaryCard {
  const seed = [show.id, show.title, show.song, show.artist, show.description]
    .filter(Boolean)
    .join(':');
  const cueCount = show.generatedCueCount ?? show.effectsCount ?? 0;

  return {
    id: show.id,
    slug: show.slug,
    title: show.title,
    songTitle: show.song,
    artist: show.artist,
    style: styleForShow(show),
    lengthSeconds: show.durationSeconds,
    cueCount,
    totalCostCents: show.totalCents ?? show.budgetCents ?? 0,
    lastEditedAt: show.updatedAt,
    palette: buildVisualPalette(seed),
    energySeries: buildEnergySeries(seed, cueCount),
    coverShader: show.coverShader,
    coverImagePath: show.coverImagePath,
  };
}

export function mapTemplateToSummary(template: ShowTemplate): TemplateSummaryCard {
  const seed = [template.id, template.title, template.theme, template.description]
    .filter(Boolean)
    .join(':');
  const cueCount = template.previewCues.length || template.effectsCount;

  return {
    id: template.id,
    slug: template.slug,
    title: template.title,
    theme: template.theme,
    lengthSeconds: template.durationSeconds,
    cueCount,
    totalCostCents: template.totalCents,
    likes: template.likeCount,
    isFeatured: template.isFeatured,
    palette: buildVisualPalette(seed),
    energySeries: buildEnergySeries(seed, cueCount),
  };
}
