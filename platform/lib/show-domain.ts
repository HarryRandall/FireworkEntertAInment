/**
 * Domain types for ShowCrafter shows.
 *
 * Pure types and small pure helpers (formatters, slug generators) only — no
 * I/O, no in-memory state. Persistence lives in `lib/shows.server.ts` and
 * the upcoming `lib/shows/*` modules; this file is the contract those
 * modules speak to the rest of the app.
 */

import type { FireworkSpec } from '@/lib/fireworks/spec';
import type { FireworkDesign, LaunchPosition } from '@/lib/fireworks/design';
import type { ShaderCover } from '@/lib/shader-cover';

export type ShowStatus = 'draft' | 'complete';
export type ShowGenerationStatus = 'idle' | 'running' | 'completed' | 'failed';

export type Show = {
  id: string;
  slug: string;
  title: string;
  song: string | null;
  artist: string | null;
  status: ShowStatus;
  durationSeconds: number | null;
  budgetCents: number | null;
  totalCents: number;
  effectsCount: number;
  syncPercent: number | null;
  safetyMeters: number | null;
  timeOfDay: string | null;
  location: string | null;
  description: string | null;
  moodTags: string[];
  audioPath: string | null;
  musicAnalysisId: string | null;
  generationStatus: ShowGenerationStatus;
  generationError: string | null;
  generatedCueCount: number | null;
  generationStartedAt: string | null;
  generationCompletedAt: string | null;
  launchPositions: LaunchPosition[];
  /** Saved shader "visual identity" for this show; null for older shows. */
  coverShader: ShaderCover | null;
  /** Storage path of the pre-rendered cover PNG in the covers bucket; null until rendered. */
  coverImagePath: string | null;
  updatedAt: string;
};

export type ShowCue = {
  id: string;
  position: number;
  timeSeconds: number | null;
  description: string;
  productId: string;
  seedOverride?: number | null;
  launchPositionIndex: number;
  /** Per-cue render emphasis (schema 1.4.0); defaults to 'normal'. */
  emphasis?: 'normal' | 'accent' | 'peak';
};

export type FireworkSpecification = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  durationSeconds: number | null;
  heightMeters: number | null;
  caliber: string | null;
  shotCount: number | null;
  spec: FireworkSpec;
  rawSpec: unknown;
  renderDesign: FireworkDesign | null;
  baseEffect: {
    id: string;
    slug: string;
    name: string;
    patternKey: string;
  } | null;
  variant: {
    id: string;
    slug: string;
    primaryColor: string | null;
    secondaryColor: string | null;
    colorPalette: string[];
  } | null;
};

export type ReplayCue = ShowCue & {
  timeSeconds: number;
  firework: FireworkSpecification;
  shotPanDegrees?: number | null;
  shotTiltDegrees?: number | null;
  shotPositionOverride?: LaunchPosition | null;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  qty: number;
  priceCents: number;
  partNumber: string;
  manufacturer: string | null;
};

/**
 * Format a duration in seconds as `m:ss` for display.
 * Falls back to a placeholder when the duration is unknown.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export function formatBudget(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatTotal(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatStableDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Convert an arbitrary user-supplied title to a URL-safe slug.
 * Falls back to a random suffix when the result would be empty.
 */
export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (base) return base;
  return `show-${Math.random().toString(36).slice(2, 8)}`;
}
