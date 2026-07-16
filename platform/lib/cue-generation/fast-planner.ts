/**
 * Fast deterministic cue planner.
 *
 * This is the default generation path because remote per-cue LLM assignment
 * can be slow. It uses the analysed musical grid, the selected show style,
 * and a compact interpretation of the user's creative brief.
 */
import type { CueSlot, SlotVibe } from '@/lib/beat-grid.server';
import { fireworkOccupancyDurationSeconds, type FireworkSpecification } from '@/lib/show-domain';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { parseCreativeDirection, type CreativeDirection } from './creative-direction';
import { scheduleProductForCueSlot } from './impact-timing';
import type { CueEmphasis, ShowBriefRow } from './schemas';
import { occupiedLaunchPositions } from './show-options';
import { asShowStyleKey, type ShowStyleKey } from './show-styles';

export type PlannedCue = {
  /** Renderer launch time persisted to `show_timeline_items.time_seconds`. */
  timeSeconds: number;
  /** Musical anchor: direct burst time or multishot sequence start. */
  impactTimeSeconds: number;
  liftTimeSeconds: number;
  tube: 0 | 1 | 2;
  productId: string;
  description: string;
  slotIndex: number;
  intensity: number;
  emphasis: CueEmphasis;
};

export type FastPlanResult = {
  cues: PlannedCue[];
  skippedSlots: number;
};

export const MAX_FAST_CUES = 220;
const MIN_STANDARD_CUES = 54;
const MIN_MINIMALIST_CUES = 30;

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

type OccupiedWindow = {
  start: number;
  end: number;
  tube: 0 | 1 | 2;
};

type ProductChoiceContext = {
  usage: Map<string, number>;
  recentProductIds: string[];
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

  const userText = [brief.title, brief.description, ...(brief.mood_tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const analysisText = [
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
  const direction = parseCreativeDirection(userText, asShowStyleKey(brief.show_style));
  // Explicit user colours and effects outrank analyser suggestions. The music
  // profile remains a fallback when the brief leaves the palette open.
  const userHints = extractPaletteHints(userText);
  const analysisHints = extractPaletteHints(analysisText);
  const hints = {
    words: userHints.words.length ? userHints.words : analysisHints.words,
    effects: userHints.effects.length ? userHints.effects : analysisHints.effects,
  };
  const surpriseImpact = direction.surprise
    ? findPreFinaleSurpriseImpact(slots, analysis, songDuration)
    : null;
  const selectedSlots = selectSlots(slots, direction, songDuration, surpriseImpact);
  // Reserve the defining musical moments first. Their lift-adjusted launches
  // can precede ordinary slots, so chronological greedy planning could
  // otherwise consume the tube window they need.
  const planningSlots = [...selectedSlots].sort(
    (a, b) =>
      slotProtectionPriority(b, direction, surpriseImpact) -
        slotProtectionPriority(a, direction, surpriseImpact) ||
      a.time - b.time ||
      a.tube - b.tube,
  );
  const maxTubes = Math.max(1, Math.min(3, ...slots.map((slot) => slot.tube + 1))) as 1 | 2 | 3;

  const occupied: OccupiedWindow[] = [];
  const multiImpacts = new Set<number>();
  const choiceContext: ProductChoiceContext = {
    usage: new Map(),
    recentProductIds: [],
  };
  let skippedSlots = 0;
  const cues: PlannedCue[] = [];

  for (const slot of planningSlots) {
    if (cues.length >= MAX_FAST_CUES) break;
    const isSurprise = surpriseImpact != null && Math.abs(slot.time - surpriseImpact) <= 0.001;
    const emphasis: CueEmphasis = isSurprise
      ? 'peak'
      : direction.softEnding && slot.finale && !slot.nearClimax
        ? 'normal'
        : slot.emphasis;
    const wantsMulti = shouldUseMultiShot({
      slot,
      direction,
      isSurprise,
      hasMultiShots: multiPool.length > 0,
    });
    const pools = wantsMulti ? [multiPool, singlePool] : [singlePool];
    let accepted:
      | {
          product: ProductInfo;
          timing: NonNullable<ReturnType<typeof scheduleProductForCueSlot>>;
          tube: 0 | 1 | 2;
          windows: OccupiedWindow[];
        }
      | undefined;

    for (const pool of pools) {
      if (!pool.length) continue;
      const softFinale = direction.softEnding && slot.finale && !slot.nearClimax;
      const preferSpectacle = !softFinale && (isSurprise || slot.nearClimax || slot.finale);
      const ranked = rankProducts(pool, slot, hints, choiceContext, {
        preferSpectacle,
        preferGentle: softFinale,
        preferFastCadence:
          !preferSpectacle &&
          (direction.precise ||
            direction.density === 'dense' ||
            slot.vibe === 'pre-chorus' ||
            slot.vibe === 'buildup' ||
            slot.vibe === 'chorus' ||
            slot.vibe === 'drop'),
      });
      for (const product of ranked) {
        const timing = scheduleProductForCueSlot({
          product: product.product,
          emphasis,
          targetTimeSeconds: slot.time,
        });
        if (!timing) continue;
        if (product.isMultiShot && multiImpacts.has(timing.impactTimeSeconds)) continue;
        const tubeOrder = [
          slot.tube,
          ...Array.from({ length: maxTubes }, (_, tube) => tube as 0 | 1 | 2).filter(
            (tube) => tube !== slot.tube,
          ),
        ];
        for (const tube of tubeOrder) {
          const occupiedTubes = occupiedLaunchPositions(product.product, tube, maxTubes);
          if (!occupiedTubes) continue;
          const windows = occupiedTubes.map((occupiedTube) => ({
            start: timing.launchTimeSeconds,
            end: timing.launchTimeSeconds + product.durationSeconds,
            tube: occupiedTube,
          }));
          if (windows.some((window) => overlapsOccupiedWindow(window, occupied))) continue;
          accepted = { product, timing, tube, windows };
          occupied.push(...windows);
          if (product.isMultiShot) multiImpacts.add(timing.impactTimeSeconds);
          break;
        }
        if (accepted) break;
      }
      if (accepted) break;
    }

    if (!accepted) {
      skippedSlots += 1;
      continue;
    }

    const cue = toCue(
      slot,
      accepted.product,
      accepted.timing,
      accepted.tube,
      emphasis,
      describeCue(slot, accepted.product, {
        isSurprise,
        multiShot: accepted.product.isMultiShot,
      }),
    );
    cues.push(cue);
    recordProductUse(choiceContext, accepted.product.product.id);
  }

  // Different lift velocities can make a later musical impact launch earlier.
  // Persistence order must follow the actual launch timeline.
  cues.sort((a, b) => a.timeSeconds - b.timeSeconds || a.tube - b.tube);
  return { cues, skippedSlots };
}

function selectSlots(
  slots: CueSlot[],
  direction: CreativeDirection,
  songDuration: number,
  surpriseImpact: number | null,
): CueSlot[] {
  const selected = new Set<number>();
  const hardExcluded = new Set<number>();
  for (const slot of slots) {
    const isSurprise = surpriseImpact != null && Math.abs(slot.time - surpriseImpact) <= 0.001;
    const quietMiddle =
      direction.quietMiddle &&
      Math.abs(slot.time - songDuration * 0.5) <= Math.min(4, songDuration * 0.04);
    if (quietMiddle && !slot.nearClimax && !isSurprise) {
      hardExcluded.add(slot.index);
      continue;
    }

    const fill = fillRatioFor(slot, direction);
    const mustKeep =
      slotProtectionPriority(slot, direction, surpriseImpact) > 0 ||
      ((slot.vibe === 'chorus' || slot.vibe === 'drop') && slot.isDownbeat);
    if (mustKeep || deterministicUnit(slot.index, slot.time, 17) <= fill) {
      selected.add(slot.index);
    }
  }

  const minimum =
    direction.style === 'minimalist' || direction.density === 'sparse'
      ? MIN_MINIMALIST_CUES
      : MIN_STANDARD_CUES;
  if (selected.size < Math.min(minimum, slots.length)) {
    const remaining = slots
      .filter((slot) => !selected.has(slot.index) && !hardExcluded.has(slot.index))
      .map((slot) => ({ slot, score: slotSelectionScore(slot) }))
      .sort((a, b) => b.score - a.score || a.slot.time - b.slot.time);
    for (const item of remaining) {
      selected.add(item.slot.index);
      if (selected.size >= Math.min(minimum, slots.length)) break;
    }
  }

  const selectedSlots = slots.filter((slot) => selected.has(slot.index));
  if (selectedSlots.length <= MAX_FAST_CUES) {
    return selectedSlots.sort((a, b) => a.time - b.time || a.tube - b.tube);
  }

  const protectedSlots = selectedSlots
    .filter((slot) => slotProtectionPriority(slot, direction, surpriseImpact) > 0)
    .sort(
      (a, b) =>
        slotProtectionPriority(b, direction, surpriseImpact) -
          slotProtectionPriority(a, direction, surpriseImpact) || a.time - b.time,
    );
  const capped = new Set(protectedSlots.slice(0, MAX_FAST_CUES).map((slot) => slot.index));
  const remaining = selectedSlots
    .filter((slot) => !capped.has(slot.index))
    .sort((a, b) => slotSelectionScore(b) - slotSelectionScore(a) || a.time - b.time);
  for (const slot of remaining) {
    if (capped.size >= MAX_FAST_CUES) break;
    capped.add(slot.index);
  }
  return selectedSlots
    .filter((slot) => capped.has(slot.index))
    .sort((a, b) => a.time - b.time || a.tube - b.tube);
}

function slotProtectionPriority(
  slot: CueSlot,
  direction: CreativeDirection,
  surpriseImpact: number | null,
): number {
  if (surpriseImpact != null && Math.abs(slot.time - surpriseImpact) <= 0.001) return 5;
  if (slot.nearClimax) return 4;
  if (direction.softEnding && slot.finale) return 0;
  if (slot.emphasis === 'peak') return 3;
  if (slot.finale) return 2;
  return 0;
}

function fillRatioFor(slot: CueSlot, direction: CreativeDirection): number {
  const byStyle: Record<Exclude<ShowStyleKey, 'beat_test'>, Record<SlotVibe, number>> = {
    signature: {
      intro: 0.55,
      verse: 0.72,
      'pre-chorus': 0.9,
      chorus: 1,
      drop: 1,
      bridge: 0.68,
      buildup: 0.92,
      outro: 0.86,
    },
    cinematic: {
      intro: 0.34,
      verse: 0.55,
      'pre-chorus': 0.76,
      chorus: 0.88,
      drop: 0.92,
      bridge: 0.62,
      buildup: 0.82,
      outro: 0.82,
    },
    minimalist: {
      intro: 0.24,
      verse: 0.38,
      'pre-chorus': 0.5,
      chorus: 0.62,
      drop: 0.68,
      bridge: 0.4,
      buildup: 0.56,
      outro: 0.58,
    },
  };
  const style = direction.style === 'beat_test' ? 'signature' : direction.style;
  let ratio = byStyle[style][slot.vibe];
  if (direction.density === 'dense') ratio += 0.12;
  if (direction.density === 'sparse') ratio -= 0.14;
  if (direction.precise && !slot.isDownbeat && slot.barPosition >= 0) ratio -= 0.06;
  if (slot.finale) {
    ratio = direction.softEnding ? ratio * 0.48 : direction.bigEnding ? 1 : Math.max(ratio, 0.86);
  }
  return clamp01(ratio);
}

function slotSelectionScore(slot: CueSlot): number {
  const vibeBoost =
    slot.vibe === 'drop' || slot.vibe === 'chorus'
      ? 0.4
      : slot.vibe === 'buildup' || slot.vibe === 'pre-chorus'
        ? 0.24
        : 0;
  return (
    slot.intensity +
    vibeBoost +
    (slot.isDownbeat ? 0.22 : 0) +
    (slot.nearClimax ? 0.7 : 0) +
    (slot.finale ? 0.32 : 0) +
    deterministicUnit(slot.index, slot.time, 29) * 0.08
  );
}

function findPreFinaleSurpriseImpact(
  slots: CueSlot[],
  analysis: AnalyserResult | null,
  songDuration: number,
): number | null {
  const finaleStart = analysis?.derived?.finale_window?.start ?? Math.max(8, songDuration - 20);
  const candidates = slots.filter(
    (slot) => slot.time >= Math.max(2, finaleStart - 14) && slot.time <= finaleStart - 2,
  );
  if (!candidates.length) return null;
  const ranked = [...candidates].sort((a, b) => {
    const score = (slot: CueSlot) =>
      slot.intensity + (slot.isDownbeat ? 0.55 : 0) + (slot.nearClimax ? 0.4 : 0);
    return score(b) - score(a) || b.time - a.time;
  });
  return ranked[0].time;
}

function shouldUseMultiShot(params: {
  slot: CueSlot;
  direction: CreativeDirection;
  isSurprise: boolean;
  hasMultiShots: boolean;
}): boolean {
  const { slot, direction, isSurprise, hasMultiShots } = params;
  if (!hasMultiShots) return false;
  // The surprise promises one visible impact. A multishot can only align its
  // sequence start, so use a large direct shell here when one is available.
  if (isSurprise) return false;
  if (direction.softEnding && slot.finale && !slot.nearClimax) return false;
  if (direction.precise && !slot.finale && !slot.nearClimax) return false;
  if (direction.style === 'minimalist' && !slot.finale && !slot.nearClimax) return false;
  return (
    slot.nearClimax ||
    slot.finale ||
    (slot.isDownbeat && (slot.intensity >= 0.76 || slot.vibe === 'chorus' || slot.vibe === 'drop'))
  );
}

function toProductInfo(product: FireworkSpecification): ProductInfo {
  const shotCount = Math.max(1, product.shotCount ?? product.spec.shots?.length ?? 1);
  const durationSeconds = Math.max(
    fireworkOccupancyDurationSeconds(product) ?? (shotCount > 1 ? 8 : 1),
    0.5,
  );
  const isMultiShot = shotCount > 1;
  const colourValues = [
    product.spec.color,
    ...(product.spec.colorPalette ?? []),
    product.variant?.primaryColor,
    product.variant?.secondaryColor,
    ...(product.variant?.colorPalette ?? []),
  ];
  const text = [
    product.name,
    product.description,
    product.caliber,
    product.spec.shellType,
    product.spec.glitter,
    product.spec.trailEffect,
    product.spec.color,
    ...(product.spec.colorPalette ?? []),
    product.variant?.primaryColor,
    product.variant?.secondaryColor,
    ...(product.variant?.colorPalette ?? []),
    product.baseEffect?.name,
    product.baseEffect?.patternKey,
    ...colourFamilyTokens(colourValues),
  ]
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const heightScore = Math.min(1, Math.max(0, (product.heightMeters ?? 45) / 220));
  const calibreScore = calibreEnergy(product.caliber);
  const effectScore =
    (product.spec.crackle ? 0.12 : 0) +
    (product.spec.strobe ? 0.1 : 0) +
    (product.spec.ring ? 0.07 : 0) +
    (product.spec.crossette ? 0.08 : 0) +
    (product.spec.horsetail ? 0.06 : 0);
  return {
    product,
    text,
    durationSeconds,
    shotCount,
    isMultiShot,
    energy: clamp01(
      heightScore * 0.48 + calibreScore * 0.27 + effectScore + (isMultiShot ? 0.2 : 0),
    ),
  };
}

function colourFamilyTokens(values: unknown[]): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const hex = value.trim().match(/^#?([0-9a-f]{6})$/i)?.[1];
    if (!hex) continue;
    const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
    const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
    const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    if (delta < 0.12) {
      if (lightness >= 0.82) tokens.add('white');
      else if (lightness >= 0.38) tokens.add('silver');
      continue;
    }
    let hue = 0;
    if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    else if (max === g) hue = ((b - r) / delta + 2) * 60;
    else hue = ((r - g) / delta + 4) * 60;
    if (hue < 18 || hue >= 345) tokens.add('red');
    else if (hue < 45) tokens.add('orange');
    else if (hue < 70) tokens.add('gold');
    else if (hue < 165) tokens.add('green');
    else if (hue < 200) tokens.add('teal');
    else if (hue < 255) tokens.add('blue');
    else if (hue < 300) tokens.add('purple');
    else tokens.add('pink');
  }
  return Array.from(tokens);
}

function rankProducts(
  products: ProductInfo[],
  slot: CueSlot,
  hints: PaletteHint,
  context: ProductChoiceContext,
  options: { preferSpectacle: boolean; preferFastCadence: boolean; preferGentle: boolean },
): ProductInfo[] {
  return [...products].sort((a, b) => {
    const scoreA = scoreProduct(a, slot, hints, context, options);
    const scoreB = scoreProduct(b, slot, hints, context, options);
    return scoreB - scoreA || a.product.id.localeCompare(b.product.id);
  });
}

function scoreProduct(
  product: ProductInfo,
  slot: CueSlot,
  hints: PaletteHint,
  context: ProductChoiceContext,
  options: { preferSpectacle: boolean; preferFastCadence: boolean; preferGentle: boolean },
): number {
  const targetEnergy = options.preferGentle
    ? Math.min(0.28, slot.intensity)
    : options.preferSpectacle
      ? Math.max(0.9, slot.intensity)
      : slot.intensity;
  const energyFit = 1 - Math.abs(product.energy - targetEnergy);
  const paletteMatches = hints.words.filter((word) => product.text.includes(word)).length;
  const effectMatches = hints.effects.filter((word) => product.text.includes(word)).length;
  const vibeFit =
    (slot.vibe === 'intro' && matchesAny(product.text, ['comet', 'willow', 'palm'])) ||
    (slot.vibe === 'buildup' && matchesAny(product.text, ['trail', 'glitter', 'comet'])) ||
    (slot.vibe === 'chorus' && matchesAny(product.text, ['crackle', 'strobe', 'ring'])) ||
    (slot.vibe === 'drop' && matchesAny(product.text, ['crackle', 'crossette', 'strobe'])) ||
    (slot.vibe === 'outro' && matchesAny(product.text, ['gold', 'crackle', 'willow']))
      ? 0.28
      : 0;
  const recentIndex = context.recentProductIds.lastIndexOf(product.product.id);
  const recentPenalty =
    recentIndex < 0 ? 0 : recentIndex === context.recentProductIds.length - 1 ? 0.72 : 0.28;
  const useCount = context.usage.get(product.product.id) ?? 0;
  const unusedBonus = useCount === 0 ? 0.18 : 0;
  const usagePenalty = Math.min(0.42, useCount * 0.035);
  const durationPenalty = options.preferFastCadence
    ? Math.min(1.15, Math.max(0, product.durationSeconds - 0.5) * 0.16)
    : Math.min(0.2, Math.max(0, product.durationSeconds - 0.5) * 0.015);
  const productJitter = deterministicProductUnit(slot.index, product.product.id) * 0.08;
  return (
    energyFit +
    paletteMatches * 0.38 +
    effectMatches * 0.22 +
    vibeFit +
    unusedBonus +
    productJitter -
    recentPenalty -
    usagePenalty -
    durationPenalty
  );
}

function recordProductUse(context: ProductChoiceContext, productId: string) {
  context.usage.set(productId, (context.usage.get(productId) ?? 0) + 1);
  context.recentProductIds.push(productId);
  if (context.recentProductIds.length > 4) context.recentProductIds.shift();
}

function extractPaletteHints(text: string): PaletteHint {
  const words = new Set<string>();
  const effects = new Set<string>();
  const colourGroups: Array<[string, string[]]> = [
    ['red', ['red', 'crimson', 'scarlet']],
    ['green', ['green', 'emerald', 'lime']],
    ['blue', ['blue', 'azure', 'cyan', 'teal']],
    ['purple', ['purple', 'violet', 'magenta']],
    ['gold', ['gold', 'golden', 'amber']],
    ['white', ['white', 'ice']],
    ['silver', ['silver']],
    ['orange', ['orange']],
    ['pink', ['pink', 'rose']],
  ];
  for (const [canonical, aliases] of colourGroups) {
    if (aliases.some((alias) => text.includes(alias))) {
      words.add(canonical);
      for (const alias of aliases) words.add(alias);
    }
  }
  if (text.includes('patriotic')) {
    words.add('red');
    words.add('white');
    words.add('blue');
  }
  for (const word of [
    'crackle',
    'strobe',
    'willow',
    'ring',
    'glitter',
    'comet',
    'palm',
    'crossette',
    'brocade',
    'horsetail',
  ]) {
    if (text.includes(word)) effects.add(word);
  }
  return { words: Array.from(words), effects: Array.from(effects) };
}

function describeCue(
  slot: CueSlot,
  product: ProductInfo,
  options: { isSurprise: boolean; multiShot: boolean },
): string {
  const section =
    slot.sectionLabel && slot.sectionLabel !== 'unknown' ? slot.sectionLabel : slot.vibe;
  if (options.isSurprise) {
    return `${product.product.name} creates the held-back surprise before the finale.`;
  }
  if (options.multiShot) {
    return `${product.product.name} begins a sustained ${section} layer on the musical boundary.`;
  }
  if (slot.nearClimax) {
    return `${product.product.name} bursts on the climax beat with a sharp accent.`;
  }
  return `${product.product.name} bursts on the ${slot.vibe} beat in ${section}.`;
}

function toCue(
  slot: CueSlot,
  product: ProductInfo,
  timing: NonNullable<ReturnType<typeof scheduleProductForCueSlot>>,
  tube: 0 | 1 | 2,
  emphasis: CueEmphasis,
  description: string,
): PlannedCue {
  return {
    timeSeconds: timing.launchTimeSeconds,
    impactTimeSeconds: timing.impactTimeSeconds,
    liftTimeSeconds: timing.liftTimeSeconds,
    tube,
    productId: product.product.id,
    description: description.slice(0, 180),
    slotIndex: slot.index,
    intensity: slot.intensity,
    emphasis,
  };
}

function overlapsOccupiedWindow(candidate: OccupiedWindow, occupied: OccupiedWindow[]) {
  return occupied.some(
    (other) =>
      other.tube === candidate.tube && candidate.start < other.end && other.start < candidate.end,
  );
}

function calibreEnergy(calibre: string | null): number {
  if (!calibre) return 0.35;
  const mm = calibre.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mm) return clamp01(Number(mm[1]) / 100);
  const inches = calibre.match(/(\d+(?:\.\d+)?)\s*["']/);
  if (inches) return clamp01((Number(inches[1]) * 25.4) / 100);
  return 0.35;
}

function matchesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function deterministicUnit(index: number, time: number, salt: number) {
  const x = Math.sin(index * 12.9898 + time * 78.233 + salt * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

function deterministicProductUnit(slotIndex: number, productId: string) {
  let hash = slotIndex * 2166136261;
  for (let i = 0; i < productId.length; i += 1) {
    hash ^= productId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
