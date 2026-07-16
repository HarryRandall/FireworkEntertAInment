import type { AdminStyleDefaultIdMap } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  isFireworkStyleDefaultKind,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';

export type FireworkEditorSnapshot = {
  kind: 'firework';
  id: string;
  name: string;
  description: string | null;
  fireworkEffectId: string;
  caliber: string | null;
  durationSeconds: number | null;
  heightMeters: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
  styleDefaultIds: AdminStyleDefaultIdMap;
  renderOverridesJson: Json;
  updatedAt: string | null;
};

export type EffectEditorSnapshot = {
  kind: 'effect';
  id: string;
  name: string;
  description: string | null;
  patternKey: string;
  sortOrder: number;
  styleDefaultIds: AdminStyleDefaultIdMap;
  modelJson: Json;
  updatedAt: string | null;
};

export type StyleDefaultEditorSnapshot = {
  kind: 'style_default';
  id: string;
  name: string;
  description: string | null;
  styleKind: FireworkStyleDefaultKind;
  sortOrder: number;
  isArchived: boolean;
  defaultsJson: Json;
  updatedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function jsonObject(value: unknown): Json {
  return isRecord(value) ? (value as Json) : {};
}

export function normaliseSnapshotStyleDefaultIds(value: unknown): AdminStyleDefaultIdMap {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => {
      const id = source[kind];
      return [kind, typeof id === 'string' && id.length > 0 ? id : null];
    }),
  ) as AdminStyleDefaultIdMap;
}

export function makeFireworkEditorSnapshot(input: FireworkEditorSnapshot): Json {
  return {
    kind: 'firework',
    id: input.id,
    name: input.name,
    description: input.description,
    fireworkEffectId: input.fireworkEffectId,
    caliber: input.caliber,
    durationSeconds: input.durationSeconds,
    heightMeters: input.heightMeters,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    colorPalette: input.colorPalette,
    styleDefaultIds: input.styleDefaultIds,
    renderOverridesJson: input.renderOverridesJson,
    updatedAt: input.updatedAt,
  };
}

export function makeEffectEditorSnapshot(input: EffectEditorSnapshot): Json {
  return {
    kind: 'effect',
    id: input.id,
    name: input.name,
    description: input.description,
    patternKey: input.patternKey,
    sortOrder: input.sortOrder,
    styleDefaultIds: input.styleDefaultIds,
    modelJson: input.modelJson,
    updatedAt: input.updatedAt,
  };
}

export function makeStyleDefaultEditorSnapshot(input: StyleDefaultEditorSnapshot): Json {
  return {
    kind: 'style_default',
    id: input.id,
    name: input.name,
    description: input.description,
    styleKind: input.styleKind,
    sortOrder: input.sortOrder,
    isArchived: input.isArchived,
    defaultsJson: input.defaultsJson,
    updatedAt: input.updatedAt,
  };
}

export function parseFireworkEditorSnapshot(value: Json | unknown): FireworkEditorSnapshot | null {
  if (!isRecord(value) || value.kind !== 'firework' || typeof value.id !== 'string') return null;
  const name =
    typeof value.name === 'string' && value.name.trim() ? value.name : 'Untitled firework';
  const fireworkEffectId =
    typeof value.fireworkEffectId === 'string' && value.fireworkEffectId
      ? value.fireworkEffectId
      : '';
  if (!fireworkEffectId) return null;

  return {
    kind: 'firework',
    id: value.id,
    name,
    description: stringOrNull(value.description),
    fireworkEffectId,
    caliber: stringOrNull(value.caliber),
    durationSeconds: numberOrNull(value.durationSeconds),
    heightMeters: numberOrNull(value.heightMeters),
    primaryColor: stringOrNull(value.primaryColor),
    secondaryColor: stringOrNull(value.secondaryColor),
    colorPalette: Array.isArray(value.colorPalette)
      ? value.colorPalette.filter((colour): colour is string => typeof colour === 'string')
      : [],
    styleDefaultIds: normaliseSnapshotStyleDefaultIds(value.styleDefaultIds),
    renderOverridesJson: jsonObject(value.renderOverridesJson),
    updatedAt: stringOrNull(value.updatedAt),
  };
}

export function parseEffectEditorSnapshot(value: Json | unknown): EffectEditorSnapshot | null {
  if (!isRecord(value) || value.kind !== 'effect' || typeof value.id !== 'string') return null;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name : 'Untitled effect';
  const patternKey =
    typeof value.patternKey === 'string' && value.patternKey ? value.patternKey : 'custom';

  return {
    kind: 'effect',
    id: value.id,
    name,
    description: stringOrNull(value.description),
    patternKey,
    sortOrder: Number.isFinite(Number(value.sortOrder)) ? Number(value.sortOrder) : 0,
    styleDefaultIds: normaliseSnapshotStyleDefaultIds(value.styleDefaultIds),
    modelJson: jsonObject(value.modelJson),
    updatedAt: stringOrNull(value.updatedAt),
  };
}

export function parseStyleDefaultEditorSnapshot(
  value: Json | unknown,
): StyleDefaultEditorSnapshot | null {
  if (!isRecord(value) || value.kind !== 'style_default' || typeof value.id !== 'string') {
    return null;
  }
  if (!isFireworkStyleDefaultKind(value.styleKind)) return null;

  return {
    kind: 'style_default',
    id: value.id,
    name:
      typeof value.name === 'string' && value.name.trim() ? value.name : 'Untitled style default',
    description: stringOrNull(value.description),
    styleKind: value.styleKind,
    sortOrder: Number.isFinite(Number(value.sortOrder)) ? Number(value.sortOrder) : 0,
    isArchived: value.isArchived === true,
    defaultsJson: jsonObject(value.defaultsJson),
    updatedAt: stringOrNull(value.updatedAt),
  };
}
