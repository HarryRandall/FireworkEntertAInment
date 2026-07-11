/**
 * Deterministic strict-sync planner.
 *
 * Every accepted aerial cue is launched early enough for its visible burst to
 * land on an analysed beat. Creative direction controls which beats are used,
 * never whether an accepted cue is allowed to drift away from its beat.
 */
import type { FireworkSpecification } from '@/lib/show-domain';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { parseCreativeDirection, type CreativeDirection } from './creative-direction';
import type { PlannedCue } from './fast-planner';
import { scheduleProductForImpact } from './impact-timing';
import type { CueEmphasis, ShowBriefRow } from './schemas';
import { asShowStyleKey } from './show-styles';

export type BeatSyncPlanResult = {
  cues: PlannedCue[];
  skippedSlots: number;
};

/** Hard safety cap so a very long track cannot create an unbounded cue list. */
const MAX_BEAT_CUES = 500;

type OccupiedWindow = {
  start: number;
  end: number;
  tube: 0 | 1 | 2;
};

type BeatTarget = {
  time: number;
  sourceIndex: number;
  isDownbeat: boolean;
  nearClimax: boolean;
  finale: boolean;
  isSurprise: boolean;
};

type BeatProductPools = {
  cadence: FireworkSpecification[];
  spectacle: FireworkSpecification[];
};

export function planCuesOnBeats(params: {
  analysis: AnalyserResult | null;
  products: FireworkSpecification[];
  songDuration: number;
  brief?: ShowBriefRow | null;
  /** Launch positions available at the site (1-3). */
  maxTubes?: 1 | 2 | 3;
}): BeatSyncPlanResult {
  const { analysis, products, songDuration, brief = null, maxTubes = 3 } = params;
  const beats = resolveBeats(analysis, songDuration);
  const briefText = [brief?.title, brief?.description, ...(brief?.mood_tags ?? [])]
    .filter(Boolean)
    .join(' ');
  const direction = parseCreativeDirection(briefText, asShowStyleKey(brief?.show_style));
  const targets = selectBeatTargets(beats, analysis, songDuration, direction);
  const productPools = pickSingleShotPools(products, brief);
  if (!beats.length || !productPools.cadence.length) {
    return { cues: [], skippedSlots: beats.length };
  }

  const occupied: OccupiedWindow[] = [];
  const cues: PlannedCue[] = [];
  let skippedSlots = beats.length - targets.length;
  let tubeRotor = 0;
  let productRotor = 0;
  // Reserve requested surprises and structural peaks before ordinary beats.
  // Lift compensation can put their launches earlier than the beats around them.
  const planningTargets = [...targets].sort(
    (a, b) =>
      beatProtectionPriority(b, direction) - beatProtectionPriority(a, direction) ||
      a.time - b.time,
  );

  for (let i = 0; i < planningTargets.length; i += 1) {
    if (cues.length >= MAX_BEAT_CUES) {
      skippedSlots += planningTargets.length - i;
      break;
    }
    const target = planningTargets[i];
    const impactTimeSeconds = Number(target.time.toFixed(3));
    const emphasis = emphasisForTarget(target, direction);
    const productOrder = orderProductsForTarget(productPools, productRotor, target);
    let accepted:
      | {
          product: FireworkSpecification;
          tube: 0 | 1 | 2;
          timing: NonNullable<ReturnType<typeof scheduleProductForImpact>>;
          window: OccupiedWindow;
        }
      | undefined;

    for (let tubeOffset = 0; tubeOffset < maxTubes && !accepted; tubeOffset += 1) {
      const tube = ((tubeRotor + tubeOffset) % maxTubes) as 0 | 1 | 2;
      for (const product of productOrder) {
        const timing = scheduleProductForImpact({ product, emphasis, impactTimeSeconds });
        if (!timing) continue;
        const window: OccupiedWindow = {
          start: timing.launchTimeSeconds,
          end: timing.launchTimeSeconds + Math.max(product.durationSeconds ?? 0.5, 0.5),
          tube,
        };
        if (overlaps(window, occupied)) continue;
        accepted = { product, tube, timing, window };
        const cadenceIndex = productPools.cadence.indexOf(product);
        if (cadenceIndex >= 0) {
          productRotor = (cadenceIndex + 1) % productPools.cadence.length;
        }
        tubeRotor = (tube + 1) % maxTubes;
        break;
      }
    }

    if (!accepted) {
      skippedSlots += 1;
      continue;
    }

    occupied.push(accepted.window);
    cues.push({
      timeSeconds: accepted.timing.launchTimeSeconds,
      impactTimeSeconds: accepted.timing.impactTimeSeconds,
      liftTimeSeconds: accepted.timing.liftTimeSeconds,
      tube: accepted.tube,
      productId: accepted.product.id,
      description: target.isSurprise
        ? `${accepted.product.name} creates the precise surprise before the finale.`.slice(0, 180)
        : `Beat ${target.sourceIndex + 1}: ${accepted.product.name} bursts on the analysed beat.`.slice(
            0,
            180,
          ),
      slotIndex: target.sourceIndex,
      intensity: emphasis === 'peak' ? 1 : emphasis === 'accent' ? 0.72 : 0.5,
      emphasis,
    });
  }

  cues.sort((a, b) => a.timeSeconds - b.timeSeconds || a.tube - b.tube);
  return { cues, skippedSlots };
}

/** Analysed beats when available, otherwise a synthetic tempo grid. */
function resolveBeats(analysis: AnalyserResult | null, songDuration: number): number[] {
  const analysed = (analysis?.beat_times ?? [])
    .filter((t) => Number.isFinite(t) && t >= 0 && t < songDuration)
    .sort((a, b) => a - b);
  if (analysed.length >= 8) return analysed;

  const tempo = clampTempo(analysis?.tempo_bpm ?? 120);
  const interval = 60 / tempo;
  const synthetic: number[] = [];
  for (let t = interval; t < songDuration - 0.25; t += interval) {
    synthetic.push(Number(t.toFixed(3)));
  }
  return synthetic;
}

function selectBeatTargets(
  beats: number[],
  analysis: AnalyserResult | null,
  songDuration: number,
  direction: CreativeDirection,
): BeatTarget[] {
  const finaleWindow = analysis?.derived?.finale_window ?? {
    start: Math.max(0, songDuration - 18),
    end: songDuration,
  };
  const analysedDownbeats = analysis?.downbeat_times ?? [];
  const beatsPerBar = Math.max(2, analysis?.beats_per_bar ?? 4);
  const targets = beats.map((time, sourceIndex) => ({
    time,
    sourceIndex,
    isDownbeat:
      analysedDownbeats.some((downbeat) => Math.abs(downbeat - time) <= 0.06) ||
      (analysedDownbeats.length === 0 && sourceIndex % beatsPerBar === 0),
    nearClimax: (analysis?.key_moments ?? []).some(
      (moment) => moment.type === 'climax' && Math.abs(moment.time - time) <= 0.12,
    ),
    finale: time >= finaleWindow.start && time <= finaleWindow.end,
    isSurprise: false,
  }));

  if (direction.surprise) {
    const candidates = targets.filter(
      (target) =>
        target.time >= Math.max(2, finaleWindow.start - 14) &&
        target.time <= finaleWindow.start - 2,
    );
    candidates.sort((a, b) => Number(b.isDownbeat) - Number(a.isDownbeat) || b.time - a.time);
    if (candidates[0]) candidates[0].isSurprise = true;
  }

  const selected = targets.filter((target) => {
    const quietMiddle =
      direction.quietMiddle &&
      Math.abs(target.time - songDuration * 0.5) <= Math.min(4, songDuration * 0.04);
    if (quietMiddle && !target.nearClimax && !target.isSurprise) return false;
    if (target.nearClimax || target.isSurprise) return true;
    if (direction.softEnding && target.finale) return target.isDownbeat;
    if (direction.bigEnding && target.finale) return true;
    if (direction.density === 'sparse') return target.isDownbeat;
    return true;
  });

  if (selected.length <= MAX_BEAT_CUES) return selected;
  const prioritised = [...selected].sort(
    (a, b) =>
      beatProtectionPriority(b, direction) - beatProtectionPriority(a, direction) ||
      Number(b.isDownbeat) - Number(a.isDownbeat) ||
      a.time - b.time,
  );
  const retained = new Set(prioritised.slice(0, MAX_BEAT_CUES).map((target) => target.sourceIndex));
  return selected.filter((target) => retained.has(target.sourceIndex));
}

function beatProtectionPriority(target: BeatTarget, direction: CreativeDirection): number {
  if (target.isSurprise) return 5;
  if (target.nearClimax) return 4;
  if (direction.softEnding && target.finale) return 0;
  if (direction.bigEnding && target.finale) return 3;
  if (target.finale && target.isDownbeat) return 2;
  return 0;
}

/**
 * Keep the shortest aerial singles that fit explicit palette words. Short
 * products leave launch positions free for more exact impacts.
 */
function pickSingleShotPools(
  products: FireworkSpecification[],
  brief: ShowBriefRow | null,
): BeatProductPools {
  const briefText = `${brief?.title ?? ''} ${brief?.description ?? ''} ${
    brief?.mood_tags?.join(' ') ?? ''
  }`.toLowerCase();
  const words = briefText.split(/[^a-z]+/).filter((word) => word.length >= 4);
  const singleShots = products.filter(
    (product) => (product.shotCount ?? 1) <= 1 && !product.hasLaunchPositionOverrides,
  );
  const aerialShots = singleShots.filter((product) => !isGroundEffect(product));
  const candidates = aerialShots.length ? aerialShots : singleShots;
  const requestedColours = requestedColourFamilies(briefText);
  const paletteMatches = new Set<FireworkSpecification>();

  for (const colour of requestedColours) {
    for (const product of candidates) {
      if (productColourFamilies(product).has(colour)) paletteMatches.add(product);
    }
  }

  const palettePool = paletteMatches.size ? [...paletteMatches] : candidates;
  const sorted = [...palettePool].sort((a, b) => {
    const briefFit = (product: FireworkSpecification) => {
      const text = productSearchText(product);
      return words.filter((word) => text.includes(word)).length;
    };
    return (
      productDuration(a) - productDuration(b) ||
      briefFit(b) - briefFit(a) ||
      a.id.localeCompare(b.id)
    );
  });
  if (!sorted.length) return { cadence: [], spectacle: [] };

  const shortest = productDuration(sorted[0]);
  const shortPool = sorted.filter((product) => productDuration(product) <= shortest + 1.5);
  const minimumVariety = Math.min(4, sorted.length);
  for (const product of sorted) {
    if (shortPool.length >= minimumVariety) break;
    if (!shortPool.includes(product)) shortPool.push(product);
  }
  return {
    cadence: shortPool,
    // Protected surprises and climaxes can draw from the complete matching
    // aerial palette, rather than being limited to cadence-optimised shells.
    spectacle: [...palettePool].sort(
      (a, b) =>
        spectacleScore(b) - spectacleScore(a) ||
        productDuration(a) - productDuration(b) ||
        a.id.localeCompare(b.id),
    ),
  };
}

function orderProductsForTarget(
  pools: BeatProductPools,
  rotor: number,
  target: BeatTarget,
): FireworkSpecification[] {
  if (target.isSurprise || target.nearClimax) {
    return pools.spectacle;
  }
  return Array.from(
    { length: pools.cadence.length },
    (_, offset) => pools.cadence[(rotor + offset) % pools.cadence.length],
  );
}

function requestedColourFamilies(text: string): string[] {
  const aliases: Record<string, string[]> = {
    red: ['red', 'reds', 'crimson', 'scarlet'],
    green: ['green', 'greens', 'emerald', 'lime'],
    blue: ['blue', 'blues', 'azure', 'cyan', 'teal'],
    purple: ['purple', 'purples', 'violet', 'magenta'],
    gold: ['gold', 'golds', 'golden', 'amber'],
    white: ['white', 'whites', 'ice', 'ivory'],
    silver: ['silver', 'silvers'],
    orange: ['orange', 'oranges'],
    pink: ['pink', 'pinks', 'rose'],
  };
  const families = Object.entries(aliases)
    .filter(([, words]) => words.some((word) => new RegExp(`\\b${word}\\b`).test(text)))
    .map(([family]) => family);
  if (/\bpatriotic\b/.test(text)) return Array.from(new Set([...families, 'red', 'white', 'blue']));
  return families;
}

function productColourFamilies(product: FireworkSpecification): Set<string> {
  const values = [
    product.spec.color,
    ...(product.spec.colorPalette ?? []),
    product.variant?.primaryColor,
    product.variant?.secondaryColor,
    ...(product.variant?.colorPalette ?? []),
  ].filter((value): value is string => typeof value === 'string');
  const text = `${productSearchText(product)} ${values.join(' ')}`;
  const families = new Set(requestedColourFamilies(text));
  for (const value of values) {
    const family = hexColourFamily(value);
    if (family) families.add(family);
  }
  return families;
}

function hexColourFamily(value: string): string | null {
  const hex = value.trim().match(/^#?([0-9a-f]{6})$/i)?.[1];
  if (!hex) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta < 0.12) return lightness >= 0.82 ? 'white' : lightness >= 0.38 ? 'silver' : null;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / delta + 2) * 60;
  else hue = ((r - g) / delta + 4) * 60;
  if (hue < 18 || hue >= 345) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 70) return 'gold';
  if (hue < 165) return 'green';
  if (hue < 200) return 'blue';
  if (hue < 255) return 'blue';
  if (hue < 300) return 'purple';
  return 'pink';
}

function productSearchText(product: FireworkSpecification): string {
  return [
    product.name,
    product.description,
    product.spec.color,
    ...(product.spec.colorPalette ?? []),
    product.variant?.primaryColor,
    product.variant?.secondaryColor,
    ...(product.variant?.colorPalette ?? []),
    product.baseEffect?.name,
    product.baseEffect?.patternKey,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function productDuration(product: FireworkSpecification | undefined): number {
  if (!product) return Infinity;
  return Math.max(product.durationSeconds ?? 0.5, 0.5);
}

function spectacleScore(product: FireworkSpecification): number {
  const height = Math.max(0, product.heightMeters ?? 0) / 220;
  const calibre = product.caliber?.match(/(\d+(?:\.\d+)?)\s*mm/i);
  const calibreScore = calibre ? Number(calibre[1]) / 100 : 0;
  return height + calibreScore;
}

function isGroundEffect(product: FireworkSpecification): boolean {
  const geometry = product.renderDesign?.geometry;
  if (geometry === 'upward_fan' || geometry === 'roman_candle' || geometry === 'fountain') {
    return true;
  }
  const text = `${product.name} ${product.description ?? ''}`.toLowerCase();
  return /fountain|gerb|roman candle|mine/.test(text);
}

function emphasisForTarget(target: BeatTarget, direction: CreativeDirection): CueEmphasis {
  if (target.isSurprise || target.nearClimax) return 'peak';
  if (direction.softEnding && target.finale) return 'normal';
  if (direction.bigEnding && target.finale) return target.isDownbeat ? 'peak' : 'accent';
  if (target.finale && target.isDownbeat) return 'peak';
  if (target.isDownbeat) return 'accent';
  return 'normal';
}

function overlaps(candidate: OccupiedWindow, occupied: OccupiedWindow[]) {
  return occupied.some(
    (other) =>
      other.tube === candidate.tube && candidate.start < other.end && other.start < candidate.end,
  );
}

function clampTempo(value: number): number {
  if (!Number.isFinite(value)) return 120;
  return Math.min(220, Math.max(50, value));
}
