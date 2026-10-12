/** Combines a parsed VDL line with existing fireworks into a create-multishot preview. */
import { shotDuration } from '@showcrafter/renderer';
import { MULTISHOT_PAN_LIMIT_DEGREES } from '../../admin/multishot-constraints.ts';
import { buildVdlFireworks, type VdlFireworkPlan } from './design.ts';
import { decodeEncodedEffect, isEncodedEffect } from './encoded.ts';
import type { VdlGlossary } from './glossary.ts';
import { parseVdlLine, type VdlRow } from './line.ts';
import { parseVdlPhrase } from './phrase.ts';

const MAX_SHOTS = 2_000; // Persisted multishot shot limit, shots.
const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.

export interface VdlExistingFirework {
  id: string;
  name: string;
}

interface VdlPreviewFirework extends VdlFireworkPlan {
  match: VdlExistingFirework | null;
}

interface VdlPreviewPart {
  letter: string;
  text: string;
  encoded: boolean;
  phrase: string;
  fireworks: string[];
  unknownWords: string[];
  approximations: string[];
  error: string | null;
}

interface VdlPreviewShot {
  sequence: number;
  letter: string;
  timeMs: number;
  angleDeg: number;
  firework: string;
  track: number;
}

export interface VdlPreview {
  name: string;
  caliberText: string | null;
  prefireS: number;
  shotCount: number;
  lastShotS: number;
  rows: VdlRow[] | null;
  parts: VdlPreviewPart[];
  fireworks: Record<string, VdlPreviewFirework>;
  shots: VdlPreviewShot[];
  warnings: string[];
}

export type VdlPreviewResult =
  | { kind: 'preview'; preview: VdlPreview }
  | { kind: 'error'; message: string };

function titleCase(text: string): string {
  return text.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

function fireworkKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Puts each shot on the first timeline track that is free when it fires, so tracks stay few. */
function packTracks(shots: VdlPreviewShot[], fireworks: Record<string, VdlPreviewFirework>) {
  const durationMs = new Map<string, number>();
  const trackEndsMs: number[] = [];
  for (const shot of shots) {
    let duration = durationMs.get(shot.firework);
    if (duration === undefined) {
      duration = shotDuration(fireworks[shot.firework].design) * MILLISECONDS_PER_SECOND;
      durationMs.set(shot.firework, duration);
    }
    let track = trackEndsMs.findIndex((endMs) => endMs <= shot.timeMs);
    if (track === -1) track = trackEndsMs.length;
    trackEndsMs[track] = shot.timeMs + duration;
    shot.track = track;
  }
}

/** Parses the line, builds a design per part and binds each to an existing firework of the same name. */
export function previewVdlCake(
  text: string,
  options: { glossary: VdlGlossary; existing: readonly VdlExistingFirework[] },
): VdlPreviewResult {
  const line = parseVdlLine(text);
  if (line.kind === 'error') return line;
  const { cake } = line;
  const existing = new Map<string, VdlExistingFirework>();
  for (const firework of options.existing) {
    const key = fireworkKey(firework.name);
    if (!existing.has(key)) existing.set(key, firework);
  }
  const fireworks: Record<string, VdlPreviewFirework> = {};
  const byLetter = new Map<string, string[]>();
  const parts: VdlPreviewPart[] = cake.parts.map((part) => {
    const encodedForm = isEncodedEffect(part.text);
    try {
      const encoded = encodedForm ? decodeEncodedEffect(part.text) : null;
      const phraseText = encoded ? titleCase(encoded.phrase) : part.text;
      const phrase = parseVdlPhrase(phraseText, options.glossary);
      const built = buildVdlFireworks(phrase, {
        caliberMm: cake.caliberMm,
        caliberText: cake.caliberText,
        encoded,
      });
      if (built.fireworks.length === 0)
        throw new Error('This part describes nothing that can be drawn.');
      const keys = built.fireworks.map((firework) => {
        const key = fireworkKey(firework.name);
        fireworks[key] ??= { ...firework, key, match: existing.get(key) ?? null };
        return key;
      });
      byLetter.set(part.letter, keys);
      return {
        letter: part.letter,
        text: part.text,
        encoded: encodedForm,
        phrase: phraseText,
        fireworks: keys,
        unknownWords: phrase.unknownWords,
        approximations: [...new Set([...phrase.approximations, ...built.approximations])],
        error: null,
      };
    } catch (failure) {
      return {
        letter: part.letter,
        text: part.text,
        encoded: encodedForm,
        phrase: part.text,
        fireworks: [],
        unknownWords: [],
        approximations: [],
        error: failure instanceof Error ? failure.message : 'This part could not be read.',
      };
    }
  });
  const warnings = [...cake.warnings];
  const startMs = cake.tubes[0]?.timeMs ?? 0;
  const shots: VdlPreviewShot[] = [];
  let clamped = false;
  for (const tube of cake.tubes) {
    const angle = Math.max(
      -MULTISHOT_PAN_LIMIT_DEGREES,
      Math.min(MULTISHOT_PAN_LIMIT_DEGREES, Math.round(tube.angleDeg)),
    );
    if (angle !== tube.angleDeg) clamped = true;
    for (const firework of byLetter.get(tube.letter) ?? [])
      shots.push({
        sequence: shots.length + 1,
        letter: tube.letter,
        timeMs: tube.timeMs - startMs,
        angleDeg: angle,
        firework,
        track: 0,
      });
  }
  if (clamped)
    warnings.push(
      `Angles beyond ${MULTISHOT_PAN_LIMIT_DEGREES} degrees were limited to ${MULTISHOT_PAN_LIMIT_DEGREES}.`,
    );
  if (shots.length > MAX_SHOTS)
    return {
      kind: 'error',
      message: `This cake needs ${shots.length} shots; multishots hold up to ${MAX_SHOTS}.`,
    };
  packTracks(shots, fireworks);
  const lastShotS = (shots.at(-1)?.timeMs ?? 0) / MILLISECONDS_PER_SECOND;
  return {
    kind: 'preview',
    preview: {
      name: [cake.caliberText, `${cake.shotCount} Shot Cake`].filter(Boolean).join(' '),
      caliberText: cake.caliberText,
      prefireS: cake.prefireS,
      shotCount: cake.shotCount,
      lastShotS,
      rows: cake.rows,
      parts,
      fireworks,
      shots,
      warnings,
    },
  };
}

/** Browser-safe preview: designs stay on the server and are rebuilt when the import is confirmed. */
export type VdlPreviewSummary = Omit<VdlPreview, 'fireworks'> & {
  fireworks: Record<string, Omit<VdlPreviewFirework, 'design'>>;
};

export function summariseVdlPreview(preview: VdlPreview): VdlPreviewSummary {
  return {
    ...preview,
    fireworks: Object.fromEntries(
      Object.entries(preview.fireworks).map(([key, firework]) => [
        key,
        {
          key: firework.key,
          name: firework.name,
          family: firework.family,
          templateKey: firework.templateKey,
          templateName: firework.templateName,
          heightM: firework.heightM,
          match: firework.match,
        },
      ]),
    ),
  };
}
