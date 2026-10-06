/** Adapters between stored multishot shots and exact Finale cake firing sequences. */
import type { CakeDocument, CakeEffect } from './document.ts';
import type { FinaleImportTube } from './import.ts';
import { exportCakeInventory, type FinaleCakeExportResult } from './export.ts';
import {
  MULTISHOT_MAX_SHOT_COUNT,
  MULTISHOT_MAX_DURATION_SECONDS,
  MULTISHOT_PAN_LIMIT_DEGREES,
} from '../admin/multishot-constraints.ts';

const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.
const LETTERS_PER_ALPHABET = 26; // Finale lower-case binding alphabet.
const MAX_BINDINGS = LETTERS_PER_ALPHABET + LETTERS_PER_ALPHABET ** 2; // Finale one or two-letter identifiers.

export type MultishotFinaleShot = {
  sequence_index: number;
  time_offset_seconds: number;
  pan_degrees: number;
  tilt_degrees: number;
  firework_id: string;
};

/** Exports horizontal pan as signed angle; non-zero depth tilt is refused because Finale has one angle. */
export function exportMultishotCake(
  shots: readonly MultishotFinaleShot[],
  effects: readonly CakeEffect[],
  partNumber: string,
): FinaleCakeExportResult {
  if (shots.some((shot) => shot.tilt_degrees !== 0))
    return {
      kind: 'error',
      message:
        'Exact cake syntax cannot represent depth tilt. Set every tilt to zero before exporting.',
    };
  const ordered = [...shots].sort(
    (a, b) => a.time_offset_seconds - b.time_offset_seconds || a.sequence_index - b.sequence_index,
  );
  const ids = [...new Set(ordered.map((shot) => shot.firework_id))];
  if (ids.length > MAX_BINDINGS)
    return { kind: 'error', message: 'Too many different fireworks for Finale letter bindings.' };
  const bindings = Object.fromEntries(ids.map((id, index) => [bindingLetter(index), id]));
  const letters = new Map(ids.map((id, index) => [id, bindingLetter(index)]));
  const document: CakeDocument = {
    bindings,
    composition: {
      tubes: ordered.map((shot, index) => ({
        i: index,
        letter: letters.get(shot.firework_id) ?? '',
        t_ms: Math.round(shot.time_offset_seconds * MILLISECONDS_PER_SECOND),
        angle_deg: shot.pan_degrees,
      })),
    },
  };
  return exportCakeInventory(document, effects, { partNumber, calibreMm: null });
}

function bindingLetter(index: number): string {
  if (index < LETTERS_PER_ALPHABET) return String.fromCharCode(97 + index);
  const pair = index - LETTERS_PER_ALPHABET;
  return String.fromCharCode(
    97 + Math.floor(pair / LETTERS_PER_ALPHABET),
    97 + (pair % LETTERS_PER_ALPHABET),
  );
}

/** Converts matched preview tubes to rows without clamping angles or inventing physical rack positions. */
export function importedMultishotShots(
  tubes: readonly FinaleImportTube[],
): { kind: 'shots'; shots: MultishotFinaleShot[] } | { kind: 'error'; message: string } {
  if (!tubes.length || tubes.length > MULTISHOT_MAX_SHOT_COUNT)
    return { kind: 'error', message: `Import between 1 and ${MULTISHOT_MAX_SHOT_COUNT} shots.` };
  if (tubes[0].timeMs !== 0)
    return { kind: 'error', message: 'Exact cake syntax requires the first tube to fire at zero.' };
  const shots: MultishotFinaleShot[] = [];
  for (const [index, tube] of tubes.entries()) {
    if (!tube.effectId || tube.problem)
      return { kind: 'error', message: 'Every imported effect needs one catalogue match.' };
    if (
      !Number.isSafeInteger(tube.timeMs) ||
      tube.timeMs < 0 ||
      !Number.isInteger(tube.angleDeg) ||
      (index > 0 && tube.timeMs < tubes[index - 1].timeMs)
    )
      return {
        kind: 'error',
        message: 'Every tube needs ordered millisecond timing and a whole-degree angle.',
      };
    if (
      Math.abs(tube.angleDeg) > MULTISHOT_PAN_LIMIT_DEGREES ||
      tube.timeMs / MILLISECONDS_PER_SECOND > MULTISHOT_MAX_DURATION_SECONDS
    )
      return {
        kind: 'error',
        message: `Multishots support pan angles up to ${MULTISHOT_PAN_LIMIT_DEGREES} degrees and firing times up to ${MULTISHOT_MAX_DURATION_SECONDS} seconds.`,
      };
    shots.push({
      sequence_index: index + 1,
      firework_id: tube.effectId,
      time_offset_seconds: tube.timeMs / MILLISECONDS_PER_SECOND,
      pan_degrees: tube.angleDeg,
      tilt_degrees: 0,
    });
  }
  return { kind: 'shots', shots };
}
