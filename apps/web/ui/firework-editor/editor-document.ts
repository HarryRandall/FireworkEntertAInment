/** Save and style-default helpers shared by the effect, firework and style-default editors. */
import type { JsonRecord } from '@/ui/firework-editor/FireworkRenderControls';
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
