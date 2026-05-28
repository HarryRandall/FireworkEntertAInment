/**
 * Fast deterministic cue planner.
 *
 * This is the default generation path because remote LLM assignment can take
 * minutes under load. It still uses the analysed song structure: slot timing,
 * intensity, section labels, climaxes, mood tags, and the user's prompt.
 */
import type { CueSlot } from '@/lib/beat-grid.server';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { ShowBriefRow } from './schemas';

export type PlannedCue = {
  timeSeconds: number;
  tube: 0 | 1 | 2;
  productId: string;
  description: string;
  slotIndex: number;
  intensity: number;
};

export type FastPlanResult = {
  cues: PlannedCue[];
  skippedSlots: number;
};

const SINGLE_TUBE_GAP_SECONDS = 0.55;
const MULTI_TUBE_GAP_SECONDS = 10;
const MAX_FAST_CUES = 110;
const MIN_FAST_CUES = 36;

type ProductInfo = {
  product: FireworkSpecification;
  text: string;
  durationSeconds: number;
  shotCount: number;
  isMultiShot: boolean;
  energy: number;
};

type PaletteHint = {
  words: string[];
  effects: string[];
};

export function planCuesFast(params: {
  brief: ShowBriefRow;
  analysis: AnalyserResult | null;
  slots: CueSlot[];
  products: FireworkSpecification[];
  songDuration: number;
}): FastPlanResult {
  const { brief, analysis, slots, products, songDuration } = params;
  const productInfos = products.map(toProductInfo).filter((p) => p.product.id);
  const singles = productInfos.filter((p) => !p.isMultiShot);
  const multis = productInfos.filter((p) => p.isMultiShot);
  const singlePool = singles.length ? singles : productInfos;
  const multiPool = multis.length ? multis : productInfos.filter((p) => p.durationSeconds > 4);
  const promptText = [
    brief.title,
    brief.description,
    brief.time_of_day,
    brief.location,
    ...(brief.mood_tags ?? []),
    analysis?.music_profile?.genre_hint,
    ...(analysis?.music_profile?.dominant_traits ?? []),
    analysis?.show_personality?.preset,
    ...(analysis?.show_personality?.dominant_traits ?? []),
    analysis?.show_personality?.density_level,
    analysis?.show_personality?.palette_direction?.primary,
    analysis?.show_personality?.palette_direction?.secondary,
    analysis?.show_personality?.palette_direction?.accent,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hints = extractPaletteHints(promptText);
  const targetCueCount = targetCueCountFor(songDuration, slots, promptText);
  const selectedSlots = selectSlots(slots, targetCueCount);

  const tubeBusyUntil: [number, number, number] = [0, 0, 0];
  let lastMultiStart = -Infinity;
  let singleCursor = 0;
  let multiCursor = 0;
  let skippedSlots = 0;
  const cues: PlannedCue[] = [];

  for (const slot of selectedSlots) {
    const freeAt = tubeBusyUntil[slot.tube];
    if (slot.time < freeAt - 0.02) {
      skippedSlots += 1;
      continue;
    }

    const shouldUseMulti =
      multiPool.length > 0 &&
      slot.time - lastMultiStart >= MULTI_TUBE_GAP_SECONDS &&
      (slot.nearClimax ||
        slot.intensity >= 0.82 ||
        slot.vibe === 'chorus' ||
        slot.vibe === 'drop' ||
        slot.vibe === 'outro');

    if (shouldUseMulti) {
      const picked = pickProduct(multiPool, slot, hints, multiCursor);
      multiCursor += 1;
      cues.push(toCue(slot, picked, describeCue(slot, picked, true)));
      tubeBusyUntil[slot.tube] = slot.time + picked.durationSeconds;
      lastMultiStart = slot.time;
      continue;
    }

    const picked = pickProduct(singlePool, slot, hints, singleCursor);
    singleCursor += 1;
    cues.push(toCue(slot, picked, describeCue(slot, picked, picked.isMultiShot)));
    tubeBusyUntil[slot.tube] =
      slot.time + (picked.isMultiShot ? picked.durationSeconds : SINGLE_TUBE_GAP_SECONDS);
    if (picked.isMultiShot) lastMultiStart = slot.time;
  }

  return { cues, skippedSlots };
}

function toProductInfo(product: FireworkSpecification): ProductInfo {
  const shotCount = Math.max(1, product.shotCount ?? product.spec.shots?.length ?? 1);
  const durationSeconds = Math.max(product.durationSeconds ?? (shotCount > 1 ? 8 : 1), 0.5);
  const isMultiShot = shotCount > 1 || durationSeconds >= 6;
  const text = [
    product.name,
    product.description,
    product.caliber,
    product.spec.shellType,
    product.spec.glitter,
    product.spec.trailEffect,
    product.spec.color,
    ...(product.spec.colorPalette ?? []),
  ]
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const heightScore = Math.min(1, Math.max(0, (product.heightMeters ?? 45) / 120));
  const effectScore =
    (product.spec.crackle ? 0.18 : 0) +
    (product.spec.strobe ? 0.14 : 0) +
    (product.spec.ring ? 0.1 : 0) +
    (product.spec.crossette ? 0.1 : 0) +
    (product.spec.horsetail ? 0.08 : 0);
  return {
    product,
    text,
    durationSeconds,
    shotCount,
    isMultiShot,
    energy: Math.min(1, heightScore + effectScore + (isMultiShot ? 0.2 : 0)),
  };
}

function targetCueCountFor(songDuration: number, slots: CueSlot[], promptText: string): number {
  const base = Math.round(songDuration / 3);
  const energetic =
    promptText.includes('high energy') ||
    promptText.includes('finale') ||
    promptText.includes('big') ||
    promptText.includes('intense');
  const adjusted = base + (energetic ? 16 : 0);
  return Math.min(MAX_FAST_CUES, Math.max(MIN_FAST_CUES, Math.min(adjusted, slots.length)));
}

function selectSlots(slots: CueSlot[], targetCount: number): CueSlot[] {
  const scored = slots.map((slot) => {
    const sectionBoost =
      slot.vibe === 'drop' || slot.vibe === 'chorus'
        ? 0.34
        : slot.vibe === 'buildup' || slot.vibe === 'pre-chorus'
          ? 0.2
          : slot.vibe === 'outro'
            ? 0.16
            : slot.vibe === 'intro'
              ? -0.12
              : 0;
    return {
      slot,
      score:
        slot.intensity +
        sectionBoost +
        (slot.nearClimax ? 0.65 : 0) +
        deterministicJitter(slot.index, slot.time),
    };
  });

  const selected = new Set<number>();
  for (const item of scored) {
    if (item.slot.nearClimax) selected.add(item.slot.index);
  }
  scored.sort((a, b) => b.score - a.score || a.slot.time - b.slot.time);
  for (const item of scored) {
    if (selected.size >= targetCount) break;
    selected.add(item.slot.index);
  }
  return slots
    .filter((slot) => selected.has(slot.index))
    .sort((a, b) => a.time - b.time || a.tube - b.tube);
}

function pickProduct(
  products: ProductInfo[],
  slot: CueSlot,
  hints: PaletteHint,
  cursor: number,
): ProductInfo {
  let best = products[0];
  let bestScore = -Infinity;
  for (let i = 0; i < products.length; i++) {
    const candidate = products[(i + cursor) % products.length];
    const score = scoreProduct(candidate, slot, hints, i);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best ?? products[0];
}

function scoreProduct(product: ProductInfo, slot: CueSlot, hints: PaletteHint, offset: number) {
  const energyFit = 1 - Math.abs(product.energy - slot.intensity);
  const paletteFit = hints.words.some((word) => product.text.includes(word)) ? 0.45 : 0;
  const effectFit = hints.effects.some((word) => product.text.includes(word)) ? 0.25 : 0;
  const vibeFit =
    (slot.vibe === 'intro' && matchesAny(product.text, ['comet', 'willow', 'palm'])) ||
    (slot.vibe === 'buildup' && matchesAny(product.text, ['trail', 'glitter', 'comet'])) ||
    (slot.vibe === 'chorus' && matchesAny(product.text, ['crackle', 'strobe', 'ring'])) ||
    (slot.vibe === 'drop' && matchesAny(product.text, ['crackle', 'crossette', 'strobe'])) ||
    (slot.vibe === 'outro' && matchesAny(product.text, ['gold', 'crackle', 'willow']))
      ? 0.28
      : 0;
  return energyFit + paletteFit + effectFit + vibeFit - offset * 0.002;
}

function extractPaletteHints(text: string): PaletteHint {
  const words = new Set<string>();
  const effects = new Set<string>();
  for (const word of ['red', 'green', 'blue', 'purple', 'gold', 'white', 'silver']) {
    if (text.includes(word)) words.add(word);
  }
  if (text.includes('patriotic')) {
    words.add('red');
    words.add('white');
    words.add('blue');
  }
  for (const word of ['crackle', 'strobe', 'willow', 'ring', 'glitter', 'comet', 'palm']) {
    if (text.includes(word)) effects.add(word);
  }
  return { words: Array.from(words), effects: Array.from(effects) };
}

function describeCue(slot: CueSlot, product: ProductInfo, multiShot: boolean): string {
  const section =
    slot.sectionLabel && slot.sectionLabel !== 'unknown' ? slot.sectionLabel : slot.vibe;
  if (multiShot) {
    return `${product.product.name} starts a sustained ${section} layer on the ${slot.vibe} pulse.`;
  }
  if (slot.nearClimax) {
    return `${product.product.name} hits the climax beat with a sharp accent.`;
  }
  return `${product.product.name} accents the ${slot.vibe} beat in ${section}.`;
}

function toCue(slot: CueSlot, product: ProductInfo, description: string): PlannedCue {
  return {
    timeSeconds: slot.time,
    tube: slot.tube,
    productId: product.product.id,
    description: description.slice(0, 180),
    slotIndex: slot.index,
    intensity: slot.intensity,
  };
}

function matchesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function deterministicJitter(index: number, time: number) {
  const x = Math.sin(index * 12.9898 + time * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 0.08;
}
