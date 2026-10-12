/** Splits one VDL effect description into `w/` segments and `To` phases, using the glossary. */
import {
  glossaryPhrase,
  type VdlAdjectiveTarget,
  type VdlFamily,
  type VdlGlossary,
  type VdlLayerPatch,
  type VdlModifier,
  type VdlTail,
  type VdlTerm,
} from './glossary.ts';

const MAX_PHRASE_WORDS = 3; // Longest glossary phrase, words.
const DEFAULT_LEVEL = 2; // A plain adjective is level 2; Slightly is 1 and Very is 3.

type Device = Extract<VdlTerm, { type: 'device' }>['device'];
type VdlNumberTag = 'HTM' | 'DUR' | 'LFT' | 'PFT' | 'DLY' | 'CDS';

export interface VdlPhase {
  words: string[];
  devices: Set<Device>;
  effect: { phrase: string; template: string; family: VdlFamily; tail?: VdlTail } | null;
  colours: string[];
  trailColour: { colour: string; star: string; tail?: VdlTail } | null;
  tip: string | null;
  modifiers: VdlModifier[];
  patches: VdlLayerPatch[];
  tails: VdlTail[];
  sounds: Set<'crackle' | 'whistle'>;
  levels: Map<VdlAdjectiveTarget, number>;
  approximations: string[];
}

export interface VdlSegment {
  text: string;
  phases: VdlPhase[];
  numbers: Partial<Record<VdlNumberTag, number>>;
  caliberMm: number | null;
}

export interface VdlPhrase {
  segments: VdlSegment[];
  unknownWords: string[];
  approximations: string[];
}

function emptyPhase(): VdlPhase {
  return {
    words: [],
    devices: new Set(),
    effect: null,
    colours: [],
    trailColour: null,
    tip: null,
    modifiers: [],
    patches: [],
    tails: [],
    sounds: new Set(),
    levels: new Map(),
    approximations: [],
  };
}

function words(text: string): string[] {
  return text
    .replace(/w\/\s*/gi, ' w/ ')
    .replace(/&/g, ' & ')
    .replace(/(\d)\s*"/g, '$1in ')
    .split(/\s+/)
    .filter(Boolean);
}

const NUMBER_TAGS = new Set<string>(['HTM', 'DUR', 'LFT', 'PFT', 'DLY', 'CDS']);
const MM_PER_INCH = 25.4; // Inch calibers, millimetres per inch.

function applyTerm(phase: VdlPhase, term: VdlTerm, phrase: string, level: number | null) {
  switch (term.type) {
    case 'device':
      phase.devices.add(term.device);
      if (term.layer) phase.patches.push(term.layer);
      if (term.approximate) phase.approximations.push(term.approximate);
      return;
    case 'effect':
      if (!phase.effect || phase.effect.family !== 'shell' || term.family === 'shell')
        phase.effect = { phrase, template: term.template, family: term.family, tail: term.tail };
      if (term.layer) phase.patches.push(term.layer);
      if (term.modifiers) phase.modifiers.push(...term.modifiers);
      if (term.tail) phase.tails.push(term.tail);
      if (term.tail === 'whistle') phase.sounds.add('whistle');
      if (term.approximate) phase.approximations.push(term.approximate);
      return;
    case 'colour':
      phase.colours.push(...term.colours);
      return;
    case 'trail-colour':
      phase.trailColour = { colour: term.colour, star: term.star, tail: term.tail };
      if (term.tail) phase.tails.push(term.tail);
      return;
    case 'tip':
      phase.tip = term.colour;
      return;
    case 'appearance':
      if (term.modifiers) phase.modifiers.push(...term.modifiers);
      if (term.layer) phase.patches.push(term.layer);
      if (term.tail) phase.tails.push(term.tail);
      if (term.sound) phase.sounds.add(term.sound);
      if (term.approximate) phase.approximations.push(term.approximate);
      return;
    case 'adjective':
      phase.levels.set(
        term.target,
        (phase.levels.get(term.target) ?? 0) + term.direction * (level ?? DEFAULT_LEVEL),
      );
      if (term.approximate) phase.approximations.push(term.approximate);
      return;
    default:
      return;
  }
}

/** Longest-match tokenisation. Unknown words are reported and skipped rather than blocking the import. */
export function parseVdlPhrase(text: string, glossary: VdlGlossary): VdlPhrase {
  const list = words(text);
  const unknownWords: string[] = [];
  const segments: VdlSegment[] = [];
  let segment: VdlSegment = { text: '', phases: [emptyPhase()], numbers: {}, caliberMm: null };
  let segmentWords: string[] = [];
  let pendingLevel: number | null = null;
  const finishSegment = () => {
    segment.text = segmentWords.join(' ');
    segments.push(segment);
    segment = { text: '', phases: [emptyPhase()], numbers: {}, caliberMm: null };
    segmentWords = [];
  };
  let index = 0;
  while (index < list.length) {
    const word = list[index];
    const phase = segment.phases[segment.phases.length - 1];
    const number = word.match(/^(\d+(?:\.\d+)?)$/);
    const tag = list[index + 1]?.toUpperCase();
    if (number && tag !== undefined && NUMBER_TAGS.has(tag)) {
      segment.numbers[tag as VdlNumberTag] = Number(number[1]);
      segmentWords.push(word, list[index + 1]);
      index += 2;
      continue;
    }
    const caliber = word.match(/^(\d+(?:\.\d+)?)(mm|in)$/i);
    if (caliber) {
      const value = Number(caliber[1]);
      segment.caliberMm = caliber[2].toLowerCase() === 'mm' ? value : value * MM_PER_INCH;
      index += 1;
      continue;
    }
    let matched: { phrase: string; term: VdlTerm; length: number } | null = null;
    for (let length = Math.min(MAX_PHRASE_WORDS, list.length - index); length > 0; length -= 1) {
      const phrase = glossaryPhrase(list.slice(index, index + length).join(' '));
      const term = glossary.get(phrase);
      if (term) {
        matched = { phrase, term, length };
        break;
      }
    }
    if (!matched) {
      if (!/^\d+(?:\.\d+)?$/.test(word)) unknownWords.push(word);
      segmentWords.push(word);
      index += 1;
      continue;
    }
    const original = list.slice(index, index + matched.length);
    index += matched.length;
    const { term } = matched;
    if (term.type === 'connector' && term.connector === 'with') {
      pendingLevel = null;
      finishSegment();
      continue;
    }
    segmentWords.push(...original);
    if (term.type === 'connector' && term.connector === 'to') {
      pendingLevel = null;
      segment.phases.push(emptyPhase());
      continue;
    }
    if (term.type === 'intensity') {
      pendingLevel = term.level;
      continue;
    }
    phase.words.push(...original);
    applyTerm(phase, term, matched.phrase, term.type === 'adjective' ? pendingLevel : null);
    if (term.type !== 'connector') pendingLevel = null;
  }
  finishSegment();
  const kept = segments.filter(
    (item) => item.text !== '' || item.phases.some((p) => p.words.length),
  );
  return {
    segments: kept,
    unknownWords: [...new Set(unknownWords)],
    approximations: [
      ...new Set(kept.flatMap((item) => item.phases.flatMap((phase) => phase.approximations))),
    ],
  };
}
