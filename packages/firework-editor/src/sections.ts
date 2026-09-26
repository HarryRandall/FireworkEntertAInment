import { isRecord } from '@showcrafter/fireworks/model/records';
import type { JsonRecord } from './types.ts';

const SECTION_FIELDS: Record<string, string[]> = {
  'launch-flight': ['liftVelocity', 'shellLife'],
  'launch-dot': ['launch.shell'],
  'launch-trail': ['launch.liftParticles'],
  smoke: ['launch.smoke'],
  geometry: ['geometry', 'geometryTuning', 'pattern'],
  star: ['stars.outer.enabled', 'stars.outer.head'],
  colour: [
    'stars.outer.colourPattern',
    'stars.outer.color',
    'colour',
    'color',
    'secondaryColor',
    'secondaryColorRatio',
  ],
  'star-movement': ['stars.outer.count', 'stars.outer.burst'],
  trail: ['stars.outer.burstTrail'],
  'star-inner': ['stars.core.enabled', 'stars.core.head'],
  'inner-colour': ['stars.core.colourPattern', 'stars.core.color'],
  'inner-movement': ['stars.core.count', 'stars.core.burst'],
  'inner-trail': ['stars.core.burstTrail'],
  'fx-strobe': ['strobe'],
  'fx-crackle': ['crackle'],
  'fx-split': ['split'],
  sound: ['sound'],
};
function read(record: unknown, path: string[]): unknown {
  for (const segment of path) {
    if (!isRecord(record)) return undefined;
    record = record[segment];
  }
  return record;
}
export function sectionChanged(id: string, draft: unknown, saved: unknown): boolean {
  return (SECTION_FIELDS[id] ?? []).some(
    (path) =>
      JSON.stringify(read(draft, path.split('.'))) !== JSON.stringify(read(saved, path.split('.'))),
  );
}
export function revertSection(id: string, draft: JsonRecord, saved: unknown): void {
  for (const field of SECTION_FIELDS[id] ?? []) {
    const path = field.split('.');
    const key = path.pop();
    if (!key) continue;
    let target = draft;
    for (const segment of path) {
      const next = target[segment];
      target[segment] = isRecord(next) ? next : {};
      target = target[segment] as JsonRecord;
    }
    const value = read(saved, [...path, key]);
    if (value === undefined) delete target[key];
    else target[key] = structuredClone(value);
  }
}
