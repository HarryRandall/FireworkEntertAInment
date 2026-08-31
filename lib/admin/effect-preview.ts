import type { AdminEffectPreview } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';

const FALLBACK_COLORS = ['#00e5ff', '#8b5cf6'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseHex(value: unknown): string | null {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : null;
}

function rgbObjectToHex(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const r = Number(value.r);
  const g = Number(value.g);
  const b = Number(value.b);
  if (![r, g, b].every(Number.isFinite)) return null;
  const toByte = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * 255)));
  return `#${[toByte(r), toByte(g), toByte(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function pushColor(colors: string[], value: unknown): void {
  const hex = normaliseHex(value) ?? rgbObjectToHex(value);
  if (hex && !colors.includes(hex)) colors.push(hex);
}

function collectColorCandidates(value: unknown, colors: string[], depth = 0): void {
  if (colors.length >= 4 || depth > 3) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectColorCandidates(item, colors, depth + 1);
      if (colors.length >= 4) return;
    }
    return;
  }

  pushColor(colors, value);
  if (!isRecord(value)) return;

  for (const key of [
    'color',
    'secondaryColor',
    'outerColor',
    'innerColor',
    'secondColor',
    'pistilColor',
    'tailColor',
    'glitterColor',
    'strobeColor',
    'tracerColor',
  ]) {
    pushColor(colors, value[key]);
  }

  for (const key of [
    'colorPalette',
    'colors',
    'peakColors',
    'regionColors',
    'renderDefaults',
    'shell',
    'launch',
  ]) {
    collectColorCandidates(value[key], colors, depth + 1);
    if (colors.length >= 4) return;
  }
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function buildEffectPreview(
  specJson: Json,
  fallback: { pattern?: string | null; name?: string | null } = {},
): AdminEffectPreview {
  const colors: string[] = [];
  collectColorCandidates(specJson, colors);

  let pattern: string | null = null;
  if (isRecord(specJson)) {
    pattern =
      stringField(specJson.pattern) ??
      stringField(specJson.shellType) ??
      (isRecord(specJson.shell) ? stringField(specJson.shell.family) : null);
  }

  return {
    colors: colors.length > 0 ? colors : FALLBACK_COLORS,
    label: fallback.name ?? pattern ?? fallback.pattern ?? 'Effect',
    pattern: pattern ?? fallback.pattern ?? null,
  };
}
