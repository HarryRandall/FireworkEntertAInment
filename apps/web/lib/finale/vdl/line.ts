/** Reads one Finale VDL cake line into lettered parts and per-tube firing times. */
const MAX_LINE_CHARACTERS = 200_000; // VDL field budget: Finale caps one effect at 16,384 characters per part.
const MAX_TUBES = 2_000; // Persisted multishot shot limit, tubes.
const DEFAULT_GAP_MS = 500; // Finale omitted outgoing-gap default, milliseconds.
const DEFAULT_SPACING_MS = 500; // Row spacing when a sequential row has no duration, milliseconds.
const DEFAULT_FAN_DEGREES = 60; // Finale default total fan angle, degrees.
const ANGLED_ROW_DEGREES = 30; // Angled rows lean to the multishot pan limit, degrees.
const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.
const MM_PER_INCH = 25.4; // Inch calibers, millimetres per inch.
const GAP_CAPTURE = 3; // Exact sequence regexp group containing the outgoing millisecond gap.

interface VdlPart {
  letter: string;
  text: string;
}

interface VdlTube {
  letter: string;
  timeMs: number;
  angleDeg: number;
  row: number;
}

export interface VdlRow {
  rows: number[];
  delayS: number;
  labels: string[];
  pattern: string;
  durationS: number | null;
  parallel: boolean;
}

interface VdlCake {
  caliberText: string | null;
  caliberMm: number | null;
  prefireS: number;
  shotCount: number;
  durationS: number | null;
  parts: VdlPart[];
  tubes: VdlTube[];
  rows: VdlRow[] | null;
  warnings: string[];
}

export type VdlLineResult = { kind: 'cake'; cake: VdlCake } | { kind: 'error'; message: string };

// Groups: caliber, prefire seconds, shot count, cake duration seconds, remainder.
const HEADER =
  /^(?:(\d+(?:\.\d+)?(?:mm|"|in))\s+)?(?:(\d+(?:\.\d+)?)\s+PFT\s+)?(\d+)\s+Shots?\s+(?:(\d+(?:\.\d+)?)s\s+)?(.+)$/i;

/** Converts `30mm`, `1.8"` or `2in` to millimetres. */
function caliberMillimetres(text: string): number | null {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*(mm|"|in)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return match[2].toLowerCase() === 'mm' ? value : value * MM_PER_INCH;
}

/** Splits text on a separator only outside `{...}` encoded effects and `(...)` groups. */
function splitTopLevel(text: string, separator: string): string[] {
  const pieces: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '{' || character === '(') depth += 1;
    else if (character === '}' || character === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && text.startsWith(separator, index)) {
      pieces.push(text.slice(start, index));
      start = index + separator.length;
      index += separator.length - 1;
    }
  }
  pieces.push(text.slice(start));
  return pieces;
}

/**
 * Reads `(a) … + (b) …`. A part whose label was dropped between two labelled parts
 * (supplier data such as `(l) … + … + (n) …`) takes the missing letter, with a warning.
 */
function parseParts(body: string, warnings: string[]): VdlPart[] {
  const parts: VdlPart[] = [];
  for (const piece of splitTopLevel(body.trim(), ' + ')) {
    const match = piece.trim().match(/^\(([a-z]{1,2})\)\s+([\s\S]+)$/);
    const previous = parts.at(-1)?.letter;
    const inferred =
      !match && previous?.length === 1 && previous < 'z'
        ? String.fromCharCode(previous.charCodeAt(0) + 1)
        : null;
    if (!match && !inferred)
      throw new Error(`Could not read the part "${piece.trim().slice(0, 60)}".`);
    const letter = match ? match[1] : (inferred ?? '');
    const text = match ? match[2] : piece;
    if (parts.some((part) => part.letter === letter))
      throw new Error(`Part (${letter}) appears twice.`);
    if (!match) warnings.push(`Part (${letter}) had no label, so it was read as (${letter}).`);
    parts.push({ letter, text: text.trim() });
  }
  return parts;
}

/** Separates the lettered parts from the trailing `, N Row(s) …` firing description. */
function splitBody(rest: string): { partsText: string; firing: string } {
  const pieces = splitTopLevel(rest, ',');
  const firingStart = pieces.findIndex((piece) => /^\s*\d+\s+Rows?\b/i.test(piece));
  if (firingStart < 1) throw new Error('Add the firing description, such as ", 1 Row (…/CAK)".');
  let partsText = pieces.slice(0, firingStart).join(',').trim();
  // Our own export places the parts before "Cake"; Finale places them after it.
  partsText = partsText.replace(/^Cake\s+/i, '').replace(/\s+Cake$/i, '');
  return { partsText, firing: pieces.slice(firingStart).join(',').trim() };
}

function exactTubes(sequence: string, durationS: number | null, warnings: string[]): VdlTube[] {
  const sections = sequence.split('/').map((section) => section.trim());
  if (sections.pop() !== 'CAK') throw new Error('The tube sequence must end with /CAK.');
  const parsed = sections.map((section) => {
    const match = section.match(/^(-?\d+)?([a-z]{1,2})(\d+)?$/);
    if (!match) throw new Error(`Could not read tube "${section}".`);
    return {
      angle: match[1] === undefined ? null : Number(match[1]),
      letter: match[2],
      gap: match[GAP_CAPTURE] === undefined ? null : Number(match[GAP_CAPTURE]),
    };
  });
  const noGaps = parsed.every((tube) => tube.gap === null);
  const evenGap =
    noGaps && durationS !== null && parsed.length > 1
      ? Math.round((durationS * MILLISECONDS_PER_SECOND) / (parsed.length - 1))
      : null;
  if (noGaps && evenGap === null && parsed.length > 1)
    warnings.push('No tube gaps were given, so shots are 0.5 s apart.');
  let angle = 0;
  let gap = evenGap ?? DEFAULT_GAP_MS;
  let time = 0;
  return parsed.map((tube) => {
    if (tube.angle !== null) angle = tube.angle;
    if (tube.gap !== null) gap = tube.gap;
    const result = { letter: tube.letter, timeMs: time, angleDeg: angle, row: 1 };
    // Each section describes the outgoing gap; omitted angles and gaps carry forward.
    time += gap;
    return result;
  });
}

function parseRowSpecs(firing: string): VdlRow[] {
  const specs: VdlRow[] = [];
  const pattern = /Rows?\s+([\d,\s]+?)\s*\(([^)]*)\)/gi;
  for (const match of firing.matchAll(pattern)) {
    const rows = match[1]
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    let fields = match[2].split('/').map((field) => field.trim());
    const parallel = fields.at(-1)?.endsWith('*') ?? false;
    if (parallel)
      fields = fields.map((field, index, all) =>
        index === all.length - 1 ? field.slice(0, -1) : field,
      );
    const delay = /^\d+(?:\.\d+)?$/.test(fields[0] ?? '') ? Number(fields.shift()) : 0;
    const labels = fields.shift() ?? '';
    if (!/^[a-z]+$/.test(labels)) throw new Error(`Could not read the shots "${labels}" in a row.`);
    const keyword = /^[A-Z]{3}$/.test(fields[0] ?? '') ? (fields.shift() ?? 'STR') : 'STR';
    const duration = /^\d+(?:\.\d+)?$/.test(fields[0] ?? '') ? Number(fields.shift()) : null;
    for (const row of rows)
      specs.push({
        rows: [row],
        delayS: delay,
        labels: [...labels],
        pattern: keyword,
        durationS: duration,
        parallel,
      });
  }
  if (specs.length === 0) throw new Error('Could not read any rows.');
  return specs.sort((a, b) => a.rows[0] - b.rows[0]);
}

/** Pan angles for one row, in firing order, within the multishot pan limit. */
function rowAngles(
  pattern: string,
  count: number,
  fanDegrees: number,
  warnings: string[],
): number[] {
  const family = pattern.slice(0, 2);
  const order = pattern.slice(2);
  const half = Math.min(fanDegrees / 2, ANGLED_ROW_DEGREES);
  const fan = Array.from({ length: count }, (_, index) =>
    count === 1 ? 0 : Math.round(-half + (2 * half * index) / (count - 1)),
  );
  switch (family) {
    case 'ST':
      return fan.map(() => 0);
    case 'FN':
      return order === 'L' ? fan.reverse() : fan;
    case 'AL':
      return fan.map(() => -ANGLED_ROW_DEGREES);
    case 'AR':
      return fan.map(() => ANGLED_ROW_DEGREES);
    case 'CT':
      return [...fan].sort((a, b) => Math.abs(a) - Math.abs(b));
    case 'OT':
      return [...fan].sort((a, b) => Math.abs(b) - Math.abs(a));
    case 'VS':
      return fan.map((_, index) => (index % 2 === 0 ? -half : half));
    default:
      warnings.push(
        `Firing pattern ${pattern} is not supported yet, so its shots fire straight up.`,
      );
      return fan.map(() => 0);
  }
}

/**
 * Lays rows out with every unspecified gap (spacing inside a row with no duration,
 * and the step into a row with no delay) set to `freeMs`; explicit delays and
 * durations are kept as written.
 */
function layoutRows(specs: VdlRow[], fanDegrees: number, freeMs: number, warnings: string[]) {
  const tubes: VdlTube[] = [];
  let previousStartMs = 0;
  let previousEndMs = 0;
  for (const [index, spec] of specs.entries()) {
    // Finale ignores the leading delay of the first row.
    const delayMs = index === 0 ? 0 : Math.round(spec.delayS * MILLISECONDS_PER_SECOND);
    const stepMs = index > 0 && !spec.parallel && delayMs === 0 ? freeMs : delayMs;
    const startMs = (spec.parallel ? previousStartMs : previousEndMs) + stepMs;
    const together = spec.pattern.endsWith('T');
    const count = spec.labels.length;
    const spanMs =
      together || count < 2
        ? 0
        : spec.durationS === null
          ? freeMs * (count - 1)
          : Math.round(spec.durationS * MILLISECONDS_PER_SECOND);
    const angles = rowAngles(spec.pattern, count, fanDegrees, warnings);
    spec.labels.forEach((letter, shot) => {
      const offset = count < 2 ? 0 : Math.round((spanMs * shot) / (count - 1));
      tubes.push({
        letter,
        timeMs: startMs + offset,
        angleDeg: angles[shot] ?? 0,
        row: spec.rows[0],
      });
    });
    previousStartMs = startMs;
    previousEndMs = startMs + spanMs;
  }
  return tubes.sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Finale sets every unspecified delay equal, filling the cake's first-to-last launch
 * time when it is known; otherwise unspecified gaps default to 0.5 s.
 */
function rowTubes(
  specs: VdlRow[],
  fanDegrees: number,
  durationS: number | null,
  warnings: string[],
): VdlTube[] {
  const lastMs = (freeMs: number) => layoutRows(specs, fanDegrees, freeMs, []).at(-1)?.timeMs ?? 0;
  // The last launch is linear in the free gap: fixed + count × free.
  const fixedMs = lastMs(0);
  const freeGaps = (lastMs(MILLISECONDS_PER_SECOND) - fixedMs) / MILLISECONDS_PER_SECOND;
  const targetMs = durationS === null ? null : durationS * MILLISECONDS_PER_SECOND;
  const freeMs =
    targetMs !== null && freeGaps > 0 && targetMs > fixedMs
      ? (targetMs - fixedMs) / freeGaps
      : DEFAULT_SPACING_MS;
  return layoutRows(specs, fanDegrees, freeMs, warnings);
}

/**
 * Parses the header, lettered parts and either exact tube syntax or Finale row syntax.
 * `durationS` (the product's first-to-last launch time) and `caliberText` fill in
 * when the line's header gives none, as Finale reads them from the product row.
 */
export function parseVdlLine(
  text: string,
  options: { durationS?: number | null; caliberText?: string | null } = {},
): VdlLineResult {
  try {
    const line = text.replace(/^﻿/, '').replace(/\s+/g, ' ').trim();
    if (line === '') throw new Error('Paste one VDL cake line.');
    if (line.length > MAX_LINE_CHARACTERS) throw new Error('The VDL line is too long.');
    const match = line.match(HEADER);
    if (!match) throw new Error('Start with the shot count, for example "30mm 24 Shot Cake …".');
    const [, caliberGroup, pftGroup, countGroup, durationGroup, rest] = match;
    const warnings: string[] = [];
    const shotCount = Number(countGroup);
    const durationS =
      durationGroup === undefined ? (options.durationS ?? null) : Number(durationGroup);
    const { partsText, firing } = splitBody(rest);
    const parts = parseParts(partsText, warnings);
    const fanMatch = rest.match(/(\d+(?:\.\d+)?)\s+Degrees\b/i);
    const fanDegrees = fanMatch ? Number(fanMatch[1]) : DEFAULT_FAN_DEGREES;
    const exact = firing.match(/^1\s+Row\s*\(([^()]*\/CAK)\)$/i);
    const rows = exact ? null : parseRowSpecs(firing);
    const tubes = exact
      ? exactTubes(exact[1], durationS, warnings)
      : rowTubes(rows ?? [], fanDegrees, durationS, warnings);
    if (tubes.length === 0 || tubes.length > MAX_TUBES)
      throw new Error(`A multishot needs between 1 and ${MAX_TUBES} shots.`);
    if (tubes.length !== shotCount)
      warnings.push(`The header says ${shotCount} shots but the rows describe ${tubes.length}.`);
    const letters = new Set(parts.map((part) => part.letter));
    const missing = [...new Set(tubes.map((tube) => tube.letter))].filter(
      (letter) => !letters.has(letter),
    );
    if (missing.length)
      throw new Error(
        `No description for part ${missing.map((letter) => `(${letter})`).join(', ')}.`,
      );
    const caliberText = caliberGroup ?? options.caliberText ?? null;
    return {
      kind: 'cake',
      cake: {
        caliberText,
        caliberMm: caliberText === null ? null : caliberMillimetres(caliberText),
        prefireS: pftGroup === undefined ? 0 : Number(pftGroup),
        shotCount,
        durationS,
        parts,
        tubes,
        rows,
        warnings,
      },
    };
  } catch (failure) {
    return {
      kind: 'error',
      message: failure instanceof Error ? failure.message : 'Could not read this VDL line.',
    };
  }
}
