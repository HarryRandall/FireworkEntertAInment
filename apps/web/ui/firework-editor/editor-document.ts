/** Save and style-default helpers shared by the effect, firework and style-default editors. */
import type { AdminStyleDefaultOption } from '@/lib/admin.types';
import type { JsonRecord } from '@/ui/firework-editor/FireworkRenderControls';
import type { SelectOption } from '@/ui/patterns/SelectField';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  NO_STYLE_DEFAULT_VALUE,
  type FireworkStyleDefaultKind,
} from '@showcrafter/fireworks/style-defaults';

/** True when `candidate` is a valid timestamp strictly before `reference`. */
export function isEarlierUpdatedAt(candidate: string, reference: string): boolean {
  const candidateTime = Date.parse(candidate);
  const referenceTime = Date.parse(reference);
  return (
    Number.isFinite(candidateTime) &&
    Number.isFinite(referenceTime) &&
    candidateTime < referenceTime
  );
}

export function cloneRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

/** Select options for a style default slot, with the current choice kept even if unlisted. */
export function styleDefaultOptions(
  options: AdminStyleDefaultOption[],
  selected: AdminStyleDefaultOption | null,
): SelectOption[] {
  const seen = new Set<string>();
  const source = selected ? [selected, ...options] : options;
  return [
    { value: NO_STYLE_DEFAULT_VALUE, label: 'Custom' },
    ...source
      .filter((option) => {
        if (seen.has(option.id)) return false;
        seen.add(option.id);
        return true;
      })
      .map((option) => ({
        value: option.id,
        label: option.name,
        description: option.description ?? undefined,
      })),
  ];
}

export function findStyleDefault(
  id: string,
  options: AdminStyleDefaultOption[],
  fallback: AdminStyleDefaultOption | null,
  localOptions: AdminStyleDefaultOption[] = [],
): AdminStyleDefaultOption | null {
  if (id === NO_STYLE_DEFAULT_VALUE) return null;
  return (
    localOptions.find((option) => option.id === id) ??
    options.find((option) => option.id === id) ??
    (fallback?.id === id ? fallback : null)
  );
}

export function toSaveStyleDefaultIds(
  ids: Record<FireworkStyleDefaultKind, string>,
): Record<FireworkStyleDefaultKind, string | null> {
  return Object.fromEntries(
    FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => [
      kind,
      ids[kind] === NO_STYLE_DEFAULT_VALUE ? null : ids[kind],
    ]),
  ) as Record<FireworkStyleDefaultKind, string | null>;
}
