/** Exact cake parsing produces a non-destructive preview before catalogue-bound composition creation. */
import { cakeDocumentSchema, type CakeDocument } from './document.ts';
import type { CakeEffect } from './document.ts';
import { readCsv } from './csv.ts';
const MAX_TEXT_LENGTH_CHARACTERS = 1_000_000; // Import text budget, characters; bounds direct descriptions as well as CSV.
const DEFAULT_GAP_MS = 500; // Finale omitted outgoing-gap default, milliseconds.
const MAX_IMPORT_TUBE_COUNT = 10_000; // Import work budget, tubes; below the catalogue smallint shot-count limit.
const GAP_CAPTURE = 3; // Exact sequence regexp group containing the outgoing millisecond gap.
const MAX_ANGLE_DEG = 90; // Persisted composition schema tilt extent, degrees.
/** Preview retains unmatched names rather than substituting a different firework. */
export interface FinaleImportTube {
  id: string;
  letter: string;
  name: string;
  effectId: string | null;
  problem: string | null;
  timeMs: number;
  angleDeg: number;
}
/** Expected format failures remain visible without losing the user's source text. */
export type FinaleImportResult =
  | { kind: 'preview'; tubes: FinaleImportTube[] }
  | { kind: 'error'; message: string };
function exactDescription(text: string): string {
  if (/^\s*\d+ Shot\b/i.test(text)) return text.trim();
  const rows = readCsv(text.replace(/^\uFEFF/, ''));
  const header = rows[0]?.map((cell) => cell.toLowerCase().replaceAll(' ', '')) ?? [];
  const descriptionIndex = header.indexOf('description');
  const vdlIndex = header.indexOf('vdl');
  const typeIndex = header.indexOf('parttype');
  const candidates =
    descriptionIndex < 0
      ? rows
      : rows
          .slice(1)
          .filter(
            (row) =>
              (typeIndex < 0 || row[typeIndex] === 'cake') &&
              /\bCake\b/i.test(row[descriptionIndex] ?? ''),
          );
  if (candidates.length !== 1) throw new Error('Import exactly one cake row at a time.');
  const row = candidates[0];
  const source =
    descriptionIndex < 0
      ? row.find((cell) => /\bCake\b/i.test(cell))
      : inventoryDescription(row, vdlIndex, descriptionIndex);
  if (source === undefined || source === '') throw new Error('No cake description found.');
  return source;
}
function inventoryDescription(row: string[], vdlIndex: number, descriptionIndex: number): string {
  if (vdlIndex >= 0 && row[vdlIndex] !== '') return row[vdlIndex];
  return row[descriptionIndex];
}
function checkTubeRange(angle: number, gap: number, time: number) {
  if (Math.abs(angle) > MAX_ANGLE_DEG || !Number.isSafeInteger(gap) || !Number.isSafeInteger(time))
    throw new Error('Tube angles or gaps are outside the supported range.');
}
function parseDescription(description: string, effects: readonly CakeEffect[]): FinaleImportTube[] {
  const exact = description.match(/^(\d+) Shot \d+(?:\.\d+)?s (.+) Cake,\s*1 Row\s*\(([^)]*)\)$/i);
  if (!exact)
    throw new Error(
      'Use exact "Cake, 1 Row (...)" syntax. Standard shapes such as Z-Shape are not supported.',
    );
  const count = Number(exact[1]);
  if (count < 1 || count > MAX_IMPORT_TUBE_COUNT)
    throw new Error('The cake tube count is outside the import limit.');
  const names = parseNames(exact[2]);
  const parts = exact[3].split('/');
  if (parts.pop() !== 'CAK') throw new Error('The cake sequence must end with /CAK.');
  if (parts.length !== count) throw new Error('The shot count does not match the tube sequence.');
  let angle = 0;
  let gap = DEFAULT_GAP_MS;
  let time = 0;
  return parts.map((part, index) => {
    const section = part.trim().match(/^(-?\d+)?([a-z]{1,2})(\d+)?$/);
    const angleText = section?.at(1);
    const gapText = section?.at(GAP_CAPTURE);
    if (!section) throw new Error(`Could not read section "${part}".`);
    if (angleText !== undefined) angle = Number(angleText);
    if (gapText !== undefined) gap = Number(gapText);
    checkTubeRange(angle, gap, time);
    const name: string | undefined = Object.hasOwn(names, section[2])
      ? names[section[2]]
      : undefined;
    if (name === undefined) throw new Error(`No name for effect ${section[2]}.`);
    const match = matchEffect(name, effects);
    const tube = {
      id: String(index),
      letter: section[2],
      name,
      ...match,
      timeMs: time,
      angleDeg: angle,
    };
    // Each section describes the outgoing gap; omitted angles and gaps carry forward.
    time += gap;
    return tube;
  });
}
function parseNames(body: string): Record<string, string> {
  const names: Record<string, string> = {};
  for (const part of body.split(' + ')) {
    const match = part.match(/^\(([a-z]{1,2})\)\s+([^+()]+)$/);
    if (!match || Object.hasOwn(names, match[1]))
      throw new Error('Invalid or duplicate effect names.');
    names[match[1]] = match[2].trim();
  }
  return names;
}
function matchEffect(name: string, effects: readonly CakeEffect[]) {
  const matches = effects.filter(
    (effect) => effect.name.trim().toLowerCase() === name.toLowerCase(),
  );
  const effect = matches.at(0);
  if (matches.length !== 1 || effect === undefined)
    return {
      effectId: null,
      problem: matches.length > 0 ? 'Ambiguous catalogue name' : 'No catalogue match',
    };
  if (/[+()\r\n]/.test(effect.name) || /\bCake\b/i.test(effect.name))
    return { effectId: null, problem: 'Name cannot be represented in exact cake syntax' };
  if (effect.document.kind !== 'shell' || effect.document.breaks.length !== 1)
    return { effectId: null, problem: 'Single-break shell required' };
  return { effectId: effect.id, problem: null };
}
/** Parses a description or one CSV cake row into preview clocks in milliseconds, without mutation. */
export function previewCakeImport(
  text: string,
  effects: readonly CakeEffect[],
): FinaleImportResult {
  try {
    if (text.length > MAX_TEXT_LENGTH_CHARACTERS) throw new Error('The import text is too large.');
    return { kind: 'preview', tubes: parseDescription(exactDescription(text), effects) };
  } catch (failure) {
    return {
      kind: 'error',
      message: failure instanceof Error ? failure.message : 'Could not read this cake.',
    };
  }
}
/** Creates a matched composition from preview; retains fuse/pitch but allocates a fresh grid without invented rack data. */
function matchedCakeDocument(
  tubes: readonly FinaleImportTube[],
  current: CakeDocument,
): CakeDocument {
  if (tubes.length === 0 || tubes.some((tube) => tube.effectId === null || tube.problem !== null))
    throw new Error('Every imported effect needs one catalogue match.');
  const cols = current.composition.box?.cols ?? Math.ceil(Math.sqrt(tubes.length));
  const box = current.composition.box;
  return cakeDocumentSchema.parse({
    bindings: Object.fromEntries(tubes.map((tube) => [tube.letter, tube.effectId])),
    composition: {
      ...(box ? { box: { ...box, rows: Math.ceil(tubes.length / cols) } } : {}),
      ...(current.composition.fuse_delay_ms === undefined
        ? {}
        : { fuse_delay_ms: current.composition.fuse_delay_ms }),
      tubes: tubes.map((tube, index) => ({
        i: index,
        letter: tube.letter,
        t_ms: tube.timeMs,
        angle_deg: tube.angleDeg,
      })),
    },
  });
}

/** Builds a transport document only when every preview name has one eligible match. */
export function importedCakeDocument(
  tubes: readonly FinaleImportTube[],
  current: CakeDocument,
): { kind: 'document'; document: CakeDocument } | { kind: 'error'; message: string } {
  try {
    return { kind: 'document', document: matchedCakeDocument(tubes, current) };
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Could not create this cake.',
    };
  }
}
