// Domain types for ShowCrafter shows. Pure types only — no in-memory data.
// Persistence helpers live in `lib/shows.server.ts` (server-only).

import type { FireworkEffectSpecV2 } from "@/lib/fireworks/spec-v2";
import type { FireworkEffectSpecV3 } from "@/lib/fireworks/spec-v3";

export type ShowStatus = "draft" | "complete";

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
  updatedAt: string;
};

export type ShowCue = {
  id: string;
  position: number;
  timeSeconds: number | null;
  description: string;
  fireworkSpecificationId: string | null;
  renderParams: FireworkRenderParams | null;
};

export type FireworkRenderSpec = {
  particleCount: number;
  burstDuration: number;
  colors: string[];
  spread: number;
  launchHeight: number;
  gravity: number;
  drag: number;
  sparkSize: number;
  trailLength: number;
  secondaryBursts?: number;
  sections?: FireworkRenderSection[];
  audioSync?: FireworkAudioSyncEvent[];
};

export type FireworkRenderParams = Partial<FireworkRenderSpec>;

export type FireworkRenderSection = {
  id: string;
  label: string;
  phase: "launch" | "burst" | "afterglow" | "secondary";
  startTimeSeconds: number;
  endTimeSeconds: number;
  burstTimeSeconds: number;
  colors: string[];
  particleCount: number;
  spread: number;
  launchHeight: number;
  burstDuration: number;
  gravity: number;
  drag: number;
  sparkSize: number;
  trailLength: number;
  secondaryBursts?: number;
  confidence?: number;
};

export type FireworkAudioSyncEvent = {
  timeSeconds: number;
  kind: "launch" | "burst" | "crackle" | "fade";
  confidence: number;
};

export type FireworkSpecification = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  spec: FireworkRenderSpec | FireworkEffectSpecV2 | FireworkEffectSpecV3;
};

export type ReplayCue = ShowCue & {
  timeSeconds: number;
  firework: FireworkSpecification;
};

export type ShoppingListItem = {
  id: string;
  position: number;
  name: string;
  qty: number;
  priceCents: number;
  fireworkPartNumber: string | null;
};

/**
 * Format a duration in seconds as `m:ss` for display.
 * Falls back to a placeholder when the duration is unknown.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function formatBudget(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString()}`;
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
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/**
 * Convert an arbitrary user-supplied title to a URL-safe slug.
 * Falls back to a random suffix when the result would be empty.
 */
export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (base) return base;
  return `show-${Math.random().toString(36).slice(2, 8)}`;
}
