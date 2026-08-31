/**
 * Deterministic strict-sync planner.
 *
 * Direct aerial cues launch early enough for their visible burst to land on an
 * analysed beat. Lane-local multishots start on section boundaries, while
 * grouped slots create simultaneous accents across every safely free tube.
 */
import { fireworkOccupancyDurationSeconds, type FireworkSpecification } from '@/lib/show-domain';
import {
  productQuantityCapacity,
  requireExactProductQuantityLedger,
  type ProductQuantityLedger,
} from '@/lib/assortments/constraints';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { CueSlot } from '@/lib/beat-grid.server';
import {
  buildBeatMoments,
  findFinalMusicalHit,
  type BeatMoment,
  type FinalMusicalHit,
} from './beat-sync-moments';
import { parseCreativeDirection, type CreativeDirection } from './creative-direction';
import { parsePromptConstraints, productEffectFamilies } from './prompt-constraints';
import type { PlannedCue } from './fast-planner';
import { scheduleProductForCueSlot } from './impact-timing';
import { GENERATED_LAUNCH_INTERVAL_SECONDS } from './launch-spacing';
import { shouldKeepPlannedMoment } from './moment-groups';
import { recurringMotifIds } from './motifs';
import type { CueEmphasis, ShowBriefRow } from './schemas';
import { occupiedLaunchPositions } from './show-options';
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

type BeatProductPools = {
  cadence: FireworkSpecification[];
  spectacle: FireworkSpecification[];
  sustained: FireworkSpecification[];
  required: FireworkSpecification[];
};

type PlanningTarget = BeatMoment & {
  exactFinalRole: 'reserved' | 'remainder' | null;
};

export function planCuesOnBeats(params: {
  analysis: AnalyserResult | null;
  slots: CueSlot[];
  products: FireworkSpecification[];
  songDuration: number;
  brief?: ShowBriefRow | null;
  /** Launch positions available at the site (1-3). */
  maxTubes?: 1 | 2 | 3;
  availabilityByProductId?: ProductQuantityLedger | null;
}): BeatSyncPlanResult {
  const {
    slots,
    products,
    songDuration,
    brief = null,
    maxTubes = 3,
    availabilityByProductId = null,
  } = params;
  const briefText = [brief?.title, brief?.description, ...(brief?.mood_tags ?? [])]
    .filter(Boolean)
    .join(' ');
  const direction = parseCreativeDirection(briefText, asShowStyleKey(brief?.show_style));
  const targets = buildBeatMoments({ slots, songDuration, direction });
  const finalMusicalHit = availabilityByProductId ? findFinalMusicalHit(slots) : null;
  const productPools = pickProductPools(products, brief);
  if (!slots.length || (!productPools.cadence.length && !availabilityByProductId)) {
    return {
      cues: requireExactProductQuantityLedger([], availabilityByProductId, 'Beat planner'),
      skippedSlots: slots.length,
    };
  }

  const occupied: OccupiedWindow[] = [];
  const cues: PlannedCue[] = [];
  let skippedSlots =
    slots.length - targets.reduce((total, target) => total + target.tubes.length, 0);
  let productRotor = 0;
  const productUsage = new Map<string, number>();
  const requiredCueCount = productQuantityCapacity(availabilityByProductId) ?? 0;
  if (requiredCueCount > MAX_BEAT_CUES) {
    throw new Error(
      `The physical assortment requires ${requiredCueCount} cues, above the beat planner limit of ${MAX_BEAT_CUES}.`,
    );
  }
  const sustainedSections = new Set<string>();
  // Reserve requested surprises and structural peaks before ordinary beats.
  // Lift compensation can put their launches earlier than the beats around them.
  const planningTargets = splitFinalTarget(targets, finalMusicalHit).sort(
    (a, b) =>
      beatProtectionPriority(b, direction) - beatProtectionPriority(a, direction) ||
      a.time - b.time,
  );

  for (let i = 0; i < planningTargets.length; i += 1) {
    if (cues.length >= MAX_BEAT_CUES) {
      skippedSlots += planningTargets
        .slice(i)
        .reduce((total, target) => total + target.tubes.length, 0);
      break;
    }
    const target = planningTargets[i];
    const isFinalMusicalHit = target.exactFinalRole === 'reserved';
    const isExactFinalTarget = target.exactFinalRole != null;
    const impactTimeSeconds = Number(target.time.toFixed(3));
    const emphasis = emphasisForTarget(target, direction);
    const targetTubes = isExactFinalTarget
      ? target.tubes.filter((tube) => tube < maxTubes)
      : tubesForTarget(target, direction, maxTubes);
    const wantsSustained =
      !isExactFinalTarget && shouldStartSustainedLayer(target, direction, sustainedSections);
    const remainingExactQuantity = availabilityByProductId
      ? Math.max(0, requiredCueCount - cues.length)
      : null;
    const tubeOrder = orderTubesForMoment(targetTubes, wantsSustained).slice(
      0,
      remainingExactQuantity ?? targetTubes.length,
    );
    const occupiedStart = occupied.length;
    const cueStart = cues.length;
    const productRotorStart = productRotor;
    const alreadyHadSustainedLayer = sustainedSections.has(target.sectionKey);
    let acceptedForMoment = 0;

    for (let tubeIndex = 0; tubeIndex < tubeOrder.length; tubeIndex += 1) {
      if (cues.length >= MAX_BEAT_CUES) break;
      const tube = tubeOrder[tubeIndex];
      const preferSustained = wantsSustained && tubeIndex === 0;
      const preferredProductOrder = orderProductsForTarget(
        productPools,
        productRotor,
        target,
        preferSustained,
      );
      const productOrder = availabilityByProductId
        ? orderRemainingExactProducts(
            products,
            preferredProductOrder,
            productUsage,
            availabilityByProductId,
            isFinalMusicalHit,
          )
        : preferredProductOrder;
      let accepted:
        | {
            product: FireworkSpecification;
            timing: NonNullable<ReturnType<typeof scheduleProductForCueSlot>>;
            windows: OccupiedWindow[];
          }
        | undefined;

      for (const product of productOrder) {
        const quantityLimit = availabilityByProductId?.get(product.id);
        if (
          availabilityByProductId &&
          (!quantityLimit || (productUsage.get(product.id) ?? 0) >= quantityLimit)
        ) {
          continue;
        }
        const timing = scheduleProductForCueSlot({
          product,
          emphasis,
          targetTimeSeconds: impactTimeSeconds,
        });
        if (!timing) continue;
        const occupiedTubes = occupiedLaunchPositions(product, tube, maxTubes);
        if (!occupiedTubes) continue;
        const windows = occupiedTubes.map((occupiedTube) => ({
          start: timing.launchTimeSeconds,
          // Independent products can be fired while an earlier effect remains
          // visible. Reserve the ignition interval, not the visual tail.
          end: timing.launchTimeSeconds + GENERATED_LAUNCH_INTERVAL_SECONDS,
          tube: occupiedTube,
        }));
        if (windows.some((window) => overlaps(window, occupied))) continue;
        accepted = { product, timing, windows };
        const cadenceIndex = productPools.cadence.indexOf(product);
        if (cadenceIndex >= 0) {
          productRotor = (cadenceIndex + 1) % productPools.cadence.length;
        }
        break;
      }

      if (!accepted) continue;

      occupied.push(...accepted.windows);
      productUsage.set(accepted.product.id, (productUsage.get(accepted.product.id) ?? 0) + 1);
      acceptedForMoment += 1;
      if ((accepted.product.shotCount ?? 1) > 1) {
        sustainedSections.add(target.sectionKey);
      }
      cues.push({
        timeSeconds: accepted.timing.launchTimeSeconds,
        impactTimeSeconds: accepted.timing.impactTimeSeconds,
        liftTimeSeconds: accepted.timing.liftTimeSeconds,
        tube,
        productId: accepted.product.id,
        description: describeBeatCue(target, accepted.product),
        slotIndex: target.slotIndices[tube] ?? target.sourceIndex,
        intensity: target.intensity,
        emphasis,
      });
    }

    if (
      !shouldKeepPlannedMoment({
        requestedTubeCount: tubeOrder.length,
        acceptedTubeCount: acceptedForMoment,
        vibe: target.vibe,
        nearClimax: target.nearClimax,
        finale: target.finale,
      })
    ) {
      for (const cue of cues.slice(cueStart)) {
        const remainingUses = (productUsage.get(cue.productId) ?? 1) - 1;
        if (remainingUses > 0) productUsage.set(cue.productId, remainingUses);
        else productUsage.delete(cue.productId);
      }
      occupied.length = occupiedStart;
      cues.length = cueStart;
      productRotor = productRotorStart;
      if (!alreadyHadSustainedLayer) sustainedSections.delete(target.sectionKey);
      acceptedForMoment = 0;
    }

    skippedSlots += Math.max(0, targetTubes.length - acceptedForMoment);
  }

  const exactCues = requireExactProductQuantityLedger(
    cues,
    availabilityByProductId,
    'Beat planner',
  );
  exactCues.sort((a, b) => a.timeSeconds - b.timeSeconds || a.tube - b.tube);
  return { cues: exactCues, skippedSlots };
}

function orderRemainingExactProducts(
  products: FireworkSpecification[],
  preferred: FireworkSpecification[],
  usage: ReadonlyMap<string, number>,
  ledger: ProductQuantityLedger,
  preferDirect: boolean,
): FireworkSpecification[] {
  const preferredIndex = new Map(preferred.map((product, index) => [product.id, index]));
  return products
    .filter((product) => (usage.get(product.id) ?? 0) < (ledger.get(product.id) ?? 0))
    .sort((left, right) => {
      const directRank = (product: FireworkSpecification) =>
        preferDirect && (product.shotCount ?? 1) > 1 ? 1 : 0;
      const directDifference = directRank(left) - directRank(right);
      if (directDifference !== 0) return directDifference;
      const leftRank = preferredIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = preferredIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.id.localeCompare(right.id);
    });
}

function beatProtectionPriority(target: PlanningTarget, direction: CreativeDirection): number {
  if (target.exactFinalRole === 'reserved') return 6;
  if (target.isSurprise) return 5;
  if (target.nearClimax) return 4;
  if (direction.softEnding && target.finale) return 0;
  if (direction.bigEnding && target.finale) return 3;
  if (target.emphasis === 'peak') return 3;
  if (target.finale && target.isDownbeat) return 2;
  if (target.isSectionStart && (target.vibe === 'chorus' || target.vibe === 'drop')) return 2;
  return 0;
}

function splitFinalTarget(
  targets: BeatMoment[],
  finalMusicalHit: FinalMusicalHit | null,
): PlanningTarget[] {
  return targets.flatMap((target): PlanningTarget[] => {
    if (!finalMusicalHit || Math.abs(target.time - finalMusicalHit.time) > 0.001) {
      return [{ ...target, exactFinalRole: null }];
    }

    const reservedTube = target.tubes.includes(finalMusicalHit.tube)
      ? finalMusicalHit.tube
      : target.tubes[0];
    if (reservedTube == null) return [{ ...target, exactFinalRole: null }];

    const reservedSlotIndices = target.slotIndices.map((slotIndex, tube) =>
      tube === reservedTube ? slotIndex : null,
    ) as BeatMoment['slotIndices'];
    const reserved: PlanningTarget = {
      ...target,
      tubes: [reservedTube],
      slotIndices: reservedSlotIndices,
      exactFinalRole: 'reserved',
    };
    const remainingTubes = target.tubes.filter((tube) => tube !== reservedTube);
    if (!remainingTubes.length) return [reserved];

    const remainderSlotIndices = target.slotIndices.map((slotIndex, tube) =>
      tube === reservedTube ? null : slotIndex,
    ) as BeatMoment['slotIndices'];
    const remainder: PlanningTarget = {
      ...target,
      sourceIndex:
        Math.min(...remainderSlotIndices.filter((index): index is number => index != null)) ||
        target.sourceIndex,
      tubes: remainingTubes,
      slotIndices: remainderSlotIndices,
      exactFinalRole: 'remainder',
    };
    return [reserved, remainder];
  });
}

/**
 * Keep short direct shots for precise accents and lane-local multishots for
 * sustained section beds. Child-position overrides are excluded here because
 * they can consume the other tubes needed by a simultaneous musical accent.
 */
function pickProductPools(
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
  const sustainedShots = products.filter(
    (product) =>
      (product.shotCount ?? 1) > 1 &&
      !product.hasLaunchPositionOverrides &&
      !(product.launchPositionOverrideIndices?.length ?? 0),
  );
  const aerialShots = singleShots.filter((product) => !isGroundEffect(product));
  const candidates = aerialShots.length
    ? aerialShots
    : singleShots.length
      ? singleShots
      : sustainedShots;
  const requestedColours = requestedColourFamilies(briefText);
  const promptConstraints = parsePromptConstraints(brief?.description ?? '');
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
  if (!sorted.length) return { cadence: [], spectacle: [], sustained: [], required: [] };

  const shortest = productDuration(sorted[0]);
  const shortPool = sorted.filter((product) => productDuration(product) <= shortest + 1.5);
  const minimumVariety = Math.min(4, sorted.length);
  for (const product of sorted) {
    if (shortPool.length >= minimumVariety) break;
    if (!shortPool.includes(product)) shortPool.push(product);
  }
  // A recurring section motif still needs to express every requested palette
  // and effect family. Seed one representative of each into the cadence rotor
  // instead of hoping a later score happens to select it.
  const required: FireworkSpecification[] = [];
  for (const colour of promptConstraints.requiredColours) {
    const representative = sorted.find((product) => productColourFamilies(product).has(colour));
    if (representative && !required.includes(representative)) required.push(representative);
    if (representative && !shortPool.includes(representative)) shortPool.push(representative);
  }
  for (const effect of promptConstraints.requestedEffects) {
    const representative = sorted.find((product) => productEffectFamilies(product).has(effect));
    if (representative && !required.includes(representative)) required.push(representative);
    if (representative && !shortPool.includes(representative)) shortPool.push(representative);
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
    sustained: [...sustainedShots].sort(
      (a, b) =>
        sustainedScore(b, requestedColours, words) - sustainedScore(a, requestedColours, words) ||
        a.id.localeCompare(b.id),
    ),
    required,
  };
}

function orderProductsForTarget(
  pools: BeatProductPools,
  rotor: number,
  target: BeatMoment,
  preferSustained: boolean,
): FireworkSpecification[] {
  const motifIds = new Set(
    recurringMotifIds(
      pools.cadence.map((product) => product.id),
      target.vibe,
      Math.max(3, pools.required.length),
    ),
  );
  const recurringCadence = Array.from(
    new Map(
      [...pools.required, ...pools.cadence.filter((product) => motifIds.has(product.id))].map(
        (product) => [product.id, product],
      ),
    ).values(),
  );
  const direct =
    target.isSurprise || target.nearClimax || target.emphasis === 'peak'
      ? pools.spectacle
      : Array.from(
          { length: recurringCadence.length },
          (_, offset) => recurringCadence[(rotor + offset) % recurringCadence.length],
        );
  if (preferSustained && pools.sustained.length) {
    const sustainedOffset = target.sourceIndex % pools.sustained.length;
    const sustained = Array.from(
      { length: pools.sustained.length },
      (_, offset) => pools.sustained[(sustainedOffset + offset) % pools.sustained.length],
    );
    return [...sustained, ...direct];
  }
  if (target.isSurprise || target.nearClimax) {
    return pools.spectacle;
  }
  return direct;
}

function shouldStartSustainedLayer(
  target: BeatMoment,
  direction: CreativeDirection,
  sustainedSections: Set<string>,
): boolean {
  if (sustainedSections.has(target.sectionKey)) return false;
  if (target.isSurprise || (direction.softEnding && target.finale)) return false;
  if (target.nearClimax) return true;
  if (!target.isDownbeat) return false;
  return (
    target.vibe === 'chorus' || target.vibe === 'drop' || (target.finale && !direction.softEnding)
  );
}

function tubesForTarget(
  target: BeatMoment,
  direction: CreativeDirection,
  maxTubes: 1 | 2 | 3,
): Array<0 | 1 | 2> {
  const available = target.tubes.filter((tube) => tube < maxTubes);
  if (target.isSurprise)
    return [available.includes(1) ? 1 : available[0]].filter(
      (tube): tube is 0 | 1 | 2 => tube != null,
    );
  if (direction.softEnding && target.finale && !target.nearClimax) {
    return available.slice(0, 1);
  }
  return available;
}

function orderTubesForMoment(tubes: Array<0 | 1 | 2>, wantsSustained: boolean): Array<0 | 1 | 2> {
  if (!wantsSustained || !tubes.includes(1)) return tubes;
  return [1, ...tubes.filter((tube) => tube !== 1)];
}

function describeBeatCue(target: BeatMoment, product: FireworkSpecification): string {
  if (target.isSurprise) {
    return `${product.name} creates the precise surprise before the finale.`.slice(0, 180);
  }
  if ((product.shotCount ?? 1) > 1) {
    return `${product.name} starts a sustained ${target.vibe} layer on the analysed beat.`.slice(
      0,
      180,
    );
  }
  return `Beat ${target.sourceIndex + 1}: ${product.name} bursts on the analysed beat.`.slice(
    0,
    180,
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
  return Math.max(fireworkOccupancyDurationSeconds(product) ?? 0.5, 0.5);
}

function spectacleScore(product: FireworkSpecification): number {
  const height = Math.max(0, product.heightMeters ?? 0) / 220;
  const calibre = product.caliber?.match(/(\d+(?:\.\d+)?)\s*mm/i);
  const calibreScore = calibre ? Number(calibre[1]) / 100 : 0;
  return height + calibreScore;
}

function sustainedScore(
  product: FireworkSpecification,
  requestedColours: string[],
  briefWords: string[],
): number {
  const shotCount = Math.max(1, product.shotCount ?? 1);
  const duration = productDuration(product);
  const density = shotCount / Math.max(1, duration);
  const colourFit = requestedColours.filter((colour) =>
    productColourFamilies(product).has(colour),
  ).length;
  const text = productSearchText(product);
  const briefFit = briefWords.filter((word) => text.includes(word)).length;
  return (
    Math.log2(shotCount + 1) * 0.65 +
    Math.min(3, density) * 0.8 +
    spectacleScore(product) * 0.35 +
    colourFit * 0.5 +
    briefFit * 0.12
  );
}

function isGroundEffect(product: FireworkSpecification): boolean {
  const geometry = product.renderDesign?.geometry;
  if (geometry === 'upward_fan' || geometry === 'roman_candle' || geometry === 'fountain') {
    return true;
  }
  const text = `${product.name} ${product.description ?? ''}`.toLowerCase();
  return /fountain|gerb|roman candle|mine/.test(text);
}

function emphasisForTarget(target: BeatMoment, direction: CreativeDirection): CueEmphasis {
  if (target.isSurprise || target.nearClimax) return 'peak';
  if (direction.softEnding && target.finale) return 'normal';
  if (direction.bigEnding && target.finale) return target.isDownbeat ? 'peak' : 'accent';
  if (target.finale && target.isDownbeat) return 'peak';
  if (target.emphasis === 'peak') return 'peak';
  if (target.isDownbeat || target.emphasis === 'accent') return 'accent';
  return target.emphasis;
}

function overlaps(candidate: OccupiedWindow, occupied: OccupiedWindow[]) {
  return occupied.some(
    (other) =>
      other.tube === candidate.tube && candidate.start < other.end && other.start < candidate.end,
  );
}
