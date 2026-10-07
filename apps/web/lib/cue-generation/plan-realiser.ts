/**
 * Deterministic realiser: turns a section-level {@link ShowPlan} into timed,
 * safe cues.
 *
 * The plan decides character (role, density, palette, effects, motif, heroes);
 * this module owns everything that must be exact: which beats fire, which
 * launch positions they use, lift and first-burst compensation, the per-tube
 * ignition interval, product rotation and the final musical hit.
 */
import type { CueSlot, SlotEmphasis } from '@/lib/beat-grid.server';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { PlannedCue } from './fast-planner';
import { scheduleProductForCueSlot } from './impact-timing';
import { GENERATED_LAUNCH_INTERVAL_SECONDS } from './launch-spacing';
import {
  cadenceCompatibility,
  localBeatIntervalSeconds,
  type ProductTimingProfiles,
} from './music-product-matching';
import {
  productColourFamilies,
  productEffectFamilies,
  productMatchesPromptConstraints,
  type ColourFamily,
  type EffectFamily,
  type PromptConstraints,
} from './prompt-constraints';
import type { CueEmphasis } from './schemas';
import type { DensityLevel, Motif, PlanSection, SectionDirection, ShowPlan } from './show-plan';
import { isGroundEffect, occupiedLaunchPositions } from './show-options';

type Tube = 0 | 1 | 2;

export type RealisedShow = {
  cues: PlannedCue[];
  /** Every moment the realiser considered, per tube, for quality evaluation. */
  slots: CueSlot[];
};

type GridBeat = {
  time: number;
  isDownbeat: boolean;
  barPosition: number;
  barIndex: number;
  /** Off-beat halfway to the next beat, used only at density 4. */
  isOffbeat: boolean;
};

type MomentKind = 'hit' | 'phrase' | 'pulse';

type Moment = {
  time: number;
  kind: MomentKind;
  beat: GridBeat;
  sectionIndex: number;
  /** 0 at section start, 1 at section end. */
  progress: number;
};

type ProductInfo = {
  product: FireworkSpecification;
  colours: Set<ColourFamily>;
  effects: Set<EffectFamily>;
  /** 0 smallest, 1 largest in this catalogue. */
  size: number;
  multishot: boolean;
  ground: boolean;
};

const MAX_REALISED_CUES = 500;
/** Share of the largest products held back for the finale. */
const FINALE_RESERVE_SHARE = 0.2;
/** Off-beats are only added when beats are at least this far apart (below about 120 BPM). */
const MIN_OFFBEAT_GAP_SECONDS = 0.5;
/** Soft cue shares, relaxed in peaks where repeated heroes create a deliberate payoff. */
const PRODUCT_SHARE_TARGET = 0.12;
const EFFECT_FAMILY_SHARE_TARGET = 0.35;
const PEAK_SHARE_MULTIPLIER = 1.5;
/** Above-target repetition must outweigh a palette or hero preference, without banning it. */
const SHARE_PENALTY_WEIGHT = 48;
/** Leave time for the final burst to fade, but never schedule a barrage beyond the music. */
const FINAL_FADE_ALLOWANCE_SECONDS = 4;
/** Low, mid and high layers rotate around the role's centre of gravity. */
const HEIGHT_LAYER_SPREAD = 0.25;
/** A named product remains prominent without treating a mention as exclusivity. */
const REQUESTED_PRODUCT_BONUS = 3;
/** Sustained layers favour phrase starts, but remain available between them. */
const MULTISHOT_PULSE_PENALTY = 1.5;
const MULTISHOT_PHRASE_PENALTY = 0.5;
/** Price preference must not outweigh musical suitability or explicit intent. */
const MAX_PRICE_PREFERENCE_PENALTY = 2;

/** Realise musical impact moments with site safety, diversity and budget preferences. */
export function realiseShowPlan(params: {
  plan: ShowPlan;
  sections: PlanSection[];
  analysis: AnalyserResult | null;
  songDuration: number;
  products: FireworkSpecification[];
  timingProfiles?: ProductTimingProfiles;
  maxTubes: 1 | 2 | 3;
  budgetCents?: number | null;
  constraints: PromptConstraints;
}): RealisedShow {
  const { plan, sections, analysis, songDuration, products, timingProfiles, maxTubes } = params;
  if (!sections.length || !products.length) return { cues: [], slots: [] };

  const grid = buildGrid(analysis, songDuration);
  if (!grid.length) return { cues: [], slots: [] };
  const moments = selectMoments({ grid, sections, plan, analysis, songDuration });
  const catalogue = describeProducts(
    products.filter((product) => productMatchesPromptConstraints(product, params.constraints)),
  );
  const reserved = finaleReserve(catalogue);

  const slots: CueSlot[] = [];
  const cues: PlannedCue[] = [];
  const ignitions: Array<{ start: number; end: number; tube: Tube }> = [];
  const usage = new Map<string, number>();
  let spentCents = 0;
  const sustainedWindows = new Map<string, Array<{ start: number; end: number; tube: Tube }>>();
  const recent: string[] = [];
  const bedSections = new Set<number>();

  const finaleStarted = (time: number) =>
    plan.sections.some(
      (direction, index) =>
        direction.role === 'finale' && (sections[index]?.start ?? Infinity) <= time,
    );

  // Hits claim their launch positions first; lift compensation can put their
  // ignitions earlier than the pulses around them.
  const counters = new Map<number, number>();
  const positioned = moments.map((moment) => {
    const direction = plan.sections[moment.sectionIndex];
    const counter = counters.get(moment.sectionIndex) ?? 0;
    counters.set(moment.sectionIndex, counter + 1);
    return { moment, tubes: tubesForMoment(moment, direction, counter, maxTubes) };
  });
  const hits = positioned.filter(({ moment }) => moment.kind === 'hit');
  const ordinary = positioned.filter(({ moment }) => moment.kind !== 'hit');
  const hitPositions = hits.reduce((sum, entry) => sum + entry.tubes.length, 0);
  const ordinaryPositions = ordinary.reduce((sum, entry) => sum + entry.tubes.length, 0);
  const available = Math.max(0, MAX_REALISED_CUES - hitPositions);
  let accumulated = 0;
  let selectedPositions = 0;
  const sampled = ordinary.filter(({ tubes }) => {
    // Thin evenly across the whole track, rather than exhausting the cue
    // ceiling during the first verses and starving the final build.
    accumulated += tubes.length * Math.min(1, available / Math.max(1, ordinaryPositions));
    if (selectedPositions + tubes.length > Math.floor(accumulated)) return false;
    selectedPositions += tubes.length;
    return true;
  });
  const ordered = [...hits, ...sampled];
  for (const { moment, tubes } of ordered) {
    if (cues.length >= MAX_REALISED_CUES) break;
    const section = sections[moment.sectionIndex];
    const direction = plan.sections[moment.sectionIndex];
    if (!section || !direction) continue;
    const emphasis = emphasisFor(moment, direction);

    const momentSlots = tubes.map((tube): CueSlot => {
      const slot: CueSlot = {
        index: slots.length,
        time: round3(moment.time),
        tube,
        intensity: round3(
          Math.min(1, 0.25 + section.energy * 0.6 + (moment.kind === 'hit' ? 0.2 : 0)),
        ),
        sectionLabel: section.label,
        vibe: section.vibe,
        nearClimax: moment.kind === 'hit' && section.containsClimax,
        isDownbeat: moment.beat.isDownbeat,
        barPosition: moment.beat.isOffbeat ? -1 : moment.beat.barPosition,
        emphasis: emphasis as SlotEmphasis,
        finale: direction.role === 'finale',
      };
      slots.push(slot);
      return slot;
    });

    // A sustained bed opens busy sections on the first phrase hit.
    const wantsBed =
      moment.kind !== 'pulse' &&
      !bedSections.has(moment.sectionIndex) &&
      direction.density >= 2 &&
      (direction.role === 'build' || direction.role === 'peak' || direction.role === 'finale') &&
      params.constraints.multishots !== 'forbidden';

    for (const [position, slot] of momentSlots.entries()) {
      const preferBed = wantsBed && position === 0;
      const ranked = rankProducts({
        catalogue,
        direction,
        section,
        moment,
        emphasis,
        preferBed,
        reserved,
        finaleStarted: finaleStarted(moment.time),
        usage,
        recent,
        beatInterval: localBeatIntervalSeconds(analysis, moment.time),
        timingProfiles,
        constraints: params.constraints,
        layerIndex: cues.length,
        targetPriceCents: params.budgetCents
          ? params.budgetCents / Math.min(MAX_REALISED_CUES, moments.length * maxTubes)
          : null,
      });
      for (const info of ranked) {
        const timing = scheduleProductForCueSlot({
          product: info.product,
          emphasis,
          targetTimeSeconds: slot.time,
          timingProfile: timingProfiles?.get(info.product.id)?.[emphasis],
        });
        if (!timing || timing.impactTimeSeconds > songDuration) continue;
        const profile = timingProfiles?.get(info.product.id)?.[emphasis];
        if (
          profile?.lastImpactOffsetSeconds != null &&
          timing.launchTimeSeconds + profile.lastImpactOffsetSeconds > songDuration
        )
          continue;
        if (
          profile?.totalDurationSeconds != null &&
          timing.launchTimeSeconds + profile.totalDurationSeconds >
            songDuration + FINAL_FADE_ALLOWANCE_SECONDS
        )
          continue;
        const price = info.product.minPriceCents ?? 0;
        if (params.budgetCents != null && spentCents + price > params.budgetCents) continue;
        const occupied = occupiedLaunchPositions(info.product, slot.tube, maxTubes);
        if (!occupied) continue;
        const windows = occupied.map((tube) => ({
          start: timing.launchTimeSeconds,
          end: timing.launchTimeSeconds + GENERATED_LAUNCH_INTERVAL_SECONDS,
          tube,
        }));
        if (windows.some((window) => overlapsIgnition(window, ignitions))) continue;
        // Hits are allocated first, so use interval overlap rather than a
        // chronological watermark that would suppress earlier cake layers.
        const activeEnd =
          timing.launchTimeSeconds +
          (profile?.totalDurationSeconds ?? info.product.durationSeconds ?? 0);
        if (
          (info.multishot || info.ground) &&
          occupied.some((tube) =>
            overlapsIgnition(
              { start: timing.launchTimeSeconds, end: activeEnd, tube },
              sustainedWindows.get(info.product.id) ?? [],
            ),
          )
        )
          continue;
        ignitions.push(...windows);
        spentCents += price;
        if (info.multishot || info.ground) {
          const active = sustainedWindows.get(info.product.id) ?? [];
          active.push(
            ...occupied.map((tube) => ({
              start: timing.launchTimeSeconds,
              end:
                timing.launchTimeSeconds +
                (profile?.totalDurationSeconds ?? info.product.durationSeconds ?? 0),
              tube,
            })),
          );
          sustainedWindows.set(info.product.id, active);
        }
        usage.set(info.product.id, (usage.get(info.product.id) ?? 0) + 1);
        recent.unshift(info.product.id);
        recent.length = Math.min(recent.length, 6);
        if (info.multishot) bedSections.add(moment.sectionIndex);
        cues.push({
          timeSeconds: timing.launchTimeSeconds,
          impactTimeSeconds: timing.impactTimeSeconds,
          liftTimeSeconds: timing.liftTimeSeconds,
          tube: slot.tube,
          productId: info.product.id,
          description: info.product.name,
          slotIndex: slot.index,
          intensity: slot.intensity,
          emphasis,
        });
        break;
      }
    }
  }

  const completed = ensurePromptRequirements({
    cues,
    slots,
    catalogue,
    constraints: params.constraints,
    timingProfiles,
    maxTubes,
    songDuration,
    budgetCents: params.budgetCents,
  });
  completed.sort((a, b) => a.timeSeconds - b.timeSeconds || a.tube - b.tube);
  return { cues: completed, slots };
}

/** Analysed beats with bar positions, or a synthetic 120 BPM grid. */
function buildGrid(analysis: AnalyserResult | null, songDuration: number): GridBeat[] {
  const cleaned = (analysis?.beat_times ?? [])
    .filter((t) => Number.isFinite(t) && t >= 0 && t < songDuration)
    .sort((a, b) => a - b)
    .filter((t, i, all) => i === 0 || t - all[i - 1] > 0.05);
  const beatsPerBar = [2, 3, 4].includes(analysis?.beats_per_bar ?? 4)
    ? (analysis?.beats_per_bar ?? 4)
    : 4;
  let beats = cleaned;
  if (beats.length < 8) {
    const tempo = Math.min(200, Math.max(60, analysis?.tempo_bpm || 120));
    const interval = 60 / tempo;
    beats = [];
    for (let t = interval; t < songDuration - 0.25; t += interval) beats.push(round3(t));
  }
  const downbeats = (analysis?.downbeat_times ?? []).filter((t) => Number.isFinite(t));
  const nearDownbeat = (t: number) => downbeats.some((d) => Math.abs(d - t) <= 0.06);
  const useDownbeats = downbeats.length > 0 && beats === cleaned;

  const grid: GridBeat[] = [];
  let barPosition = 0;
  let barIndex = 0;
  beats.forEach((time, index) => {
    const isDownbeat = useDownbeats ? nearDownbeat(time) : index % beatsPerBar === 0;
    if (index > 0) {
      barPosition = isDownbeat ? 0 : barPosition + 1;
      // A missed downbeat still closes the bar after beatsPerBar beats.
      if (barPosition >= beatsPerBar) barPosition = 0;
      if (barPosition === 0) barIndex += 1;
    }
    grid.push({ time, isDownbeat, barPosition, barIndex, isOffbeat: false });
  });
  return grid;
}

/** Which beats fire in each section, plus phrase starts, climaxes and the final hit. */
function selectMoments(params: {
  grid: GridBeat[];
  sections: PlanSection[];
  plan: ShowPlan;
  analysis: AnalyserResult | null;
  songDuration: number;
}): Moment[] {
  const { grid, sections, plan, analysis } = params;
  const moments = new Map<number, Moment>();
  const add = (moment: Moment) => {
    const key = Math.round(moment.time * 1000);
    const existing = moments.get(key);
    if (!existing || kindRank(moment.kind) > kindRank(existing.kind)) moments.set(key, moment);
  };
  const energyTimeline = analysis?.energy_timeline ?? [];
  const energyNear = (time: number) => {
    const points = energyTimeline.filter((point) => Math.abs(point.time - time) <= 1);
    return points.length ? Math.max(...points.map((point) => point.energy)) : null;
  };

  for (const section of sections) {
    const direction = plan.sections[section.index];
    if (!direction) continue;
    const beats = grid.filter((beat) => beat.time >= section.start && beat.time < section.end);
    if (!beats.length) continue;
    const span = Math.max(0.001, section.end - section.start);
    const firstBar = beats[0]?.barIndex ?? 0;

    for (const [index, beat] of beats.entries()) {
      const progress = (beat.time - section.start) / span;
      const moment = (kind: MomentKind, time = beat.time, source = beat): Moment => ({
        time,
        kind,
        beat: source,
        sectionIndex: section.index,
        progress,
      });
      if (index === 0) {
        add(moment('phrase'));
        continue;
      }
      const level = densityAt(direction, progress);
      if (!firesAtDensity(beat, level, firstBar)) continue;
      // Within busy sections, quiet dips below the section's own level
      // thin out to downbeats so the texture follows the music.
      const local = energyNear(beat.time);
      if (level >= 2 && !beat.isDownbeat && local != null && local < section.energy * 0.6) {
        continue;
      }
      add(moment('pulse'));
      const next = grid[grid.indexOf(beat) + 1];
      if (level >= 4 && next && next.time - beat.time >= MIN_OFFBEAT_GAP_SECONDS) {
        const offTime = round3((beat.time + next.time) / 2);
        if (offTime < section.end) {
          add(moment('pulse', offTime, { ...beat, isDownbeat: false, isOffbeat: true }));
        }
      }
    }
  }

  const nearestBeat = (time: number) =>
    grid.reduce((best, beat) =>
      Math.abs(beat.time - time) < Math.abs(best.time - time) ? beat : best,
    );
  const sectionIndexAt = (time: number) =>
    Math.max(
      0,
      sections.findIndex((section) => time >= section.start && time < section.end),
    );
  const hits = [
    ...(analysis?.key_moments ?? []).filter((m) => m.type === 'climax').map((m) => m.time),
    ...(analysis?.buildups ?? []).map((b) => b.peak),
  ];
  for (const time of hits) {
    const beat = nearestBeat(time);
    if (Math.abs(beat.time - time) > 0.6) continue;
    add({
      time: beat.time,
      kind: 'hit',
      beat,
      sectionIndex: sectionIndexAt(beat.time),
      progress: 0.5,
    });
  }
  // Peak and finale sections open with a full-width hit.
  for (const section of sections) {
    const role = plan.sections[section.index]?.role;
    if (role !== 'peak' && role !== 'finale') continue;
    const first = grid.find((beat) => beat.time >= section.start && beat.time < section.end);
    if (first)
      add({ time: first.time, kind: 'hit', beat: first, sectionIndex: section.index, progress: 0 });
  }
  const last = grid.at(-1);
  if (last) {
    add({
      time: last.time,
      kind: 'hit',
      beat: last,
      sectionIndex: sectionIndexAt(last.time),
      progress: 1,
    });
  }

  return [...moments.values()].sort((a, b) => a.time - b.time);
}

function kindRank(kind: MomentKind): number {
  return kind === 'hit' ? 2 : kind === 'phrase' ? 1 : 0;
}

/** Builds climb from one level below the plan to one above it across the section. */
function densityAt(direction: SectionDirection, progress: number): DensityLevel {
  if (direction.role !== 'build') return direction.density;
  const shift = progress < 1 / 3 ? -1 : progress < 2 / 3 ? 0 : 1;
  return Math.max(0, Math.min(4, direction.density + shift)) as DensityLevel;
}

function firesAtDensity(beat: GridBeat, level: DensityLevel, firstBar: number): boolean {
  if (level >= 3) return true;
  if (level === 2) return beat.barPosition % 2 === 0;
  if (!beat.isDownbeat && beat.barPosition !== 0) return false;
  return level === 1 || (beat.barIndex - firstBar) % 2 === 0;
}

/** Launch positions for one moment, following the section's motif. */
function tubesForMoment(
  moment: Moment,
  direction: SectionDirection,
  counter: number,
  maxTubes: 1 | 2 | 3,
): Tube[] {
  const all: Tube[] = maxTubes === 3 ? [0, 1, 2] : maxTubes === 2 ? [0, 1] : [0];
  if (maxTubes === 1) return [0];
  const edges: Tube[] = [0, (maxTubes - 1) as Tube];
  const centre: Tube = maxTubes === 3 ? 1 : ((counter % 2) as Tube);
  if (moment.kind === 'hit') return all;
  // Sparse passages fire one position at a time; the motif decides which.
  if (direction.density <= 1 && direction.role !== 'finale' && moment.kind === 'pulse') {
    const path: Tube[] =
      direction.motif === 'unison' || direction.motif === 'mirror'
        ? all
        : maxTubes === 3
          ? [0, 1, 2, 1]
          : [0, 1];
    return [path[counter % path.length] ?? 0];
  }
  const strong = moment.beat.isDownbeat || moment.kind === 'phrase';
  const busy = direction.density >= 3 || direction.role === 'finale';
  const motif: Motif = direction.motif;
  switch (motif) {
    case 'unison':
      return strong ? all : [all[counter % all.length] ?? centre];
    case 'mirror':
      return strong ? (busy ? all : edges) : [all[counter % all.length] ?? centre];
    case 'alternate': {
      const side = all[counter % all.length] ?? 0;
      return strong && busy ? edges : [side];
    }
    case 'chase': {
      const tube = all[counter % all.length] ?? 0;
      return strong && busy ? all : [tube];
    }
    case 'sweep': {
      const path: Tube[] = maxTubes === 3 ? [0, 1, 2, 1] : [0, 1];
      const tube = path[counter % path.length] ?? 0;
      return strong && busy ? all : [tube];
    }
  }
}

function emphasisFor(moment: Moment, direction: SectionDirection): CueEmphasis {
  if (moment.kind === 'hit') return 'peak';
  const strongRole =
    direction.role === 'peak' ||
    direction.role === 'finale' ||
    (direction.role === 'build' && moment.progress >= 2 / 3);
  if (strongRole && (moment.beat.isDownbeat || moment.kind === 'phrase')) return 'accent';
  return 'normal';
}

function describeProducts(products: FireworkSpecification[]): ProductInfo[] {
  const raw = products.map((product) => {
    const calibre = product.caliber?.match(/(\d+(?:\.\d+)?)\s*mm/i);
    const calibreMm = calibre ? Number(calibre[1]) : 0;
    return { product, raw: calibreMm / 25 + Math.max(0, product.heightMeters ?? 0) / 40 };
  });
  const values = raw.map((entry) => entry.raw).sort((a, b) => a - b);
  const rank = (value: number) =>
    values.length > 1 ? values.indexOf(value) / (values.length - 1) : 0.5;
  return raw.map(({ product, raw: value }) => ({
    product,
    colours: productColourFamilies(product),
    effects: productEffectFamilies(product),
    size: rank(value),
    multishot: (product.shotCount ?? 1) > 1,
    ground: isGroundEffect(product),
  }));
}

/** The largest aerial products, kept for the finale when the catalogue allows. */
function finaleReserve(catalogue: ProductInfo[]): Set<string> {
  const aerial = catalogue.filter((info) => !info.ground);
  if (aerial.length < 5) return new Set();
  const count = Math.max(1, Math.floor(aerial.length * FINALE_RESERVE_SHARE));
  return new Set(
    [...aerial]
      .sort((a, b) => b.size - a.size || a.product.id.localeCompare(b.product.id))
      .slice(0, count)
      .map((info) => info.product.id),
  );
}

const TARGET_SIZE: Record<SectionDirection['role'], number> = {
  opener: 0.4,
  body: 0.45,
  lull: 0.2,
  build: 0.5,
  peak: 0.7,
  finale: 0.85,
  outro: 0.3,
};

function rankProducts(params: {
  catalogue: ProductInfo[];
  direction: SectionDirection;
  section: PlanSection;
  moment: Moment;
  emphasis: CueEmphasis;
  preferBed: boolean;
  reserved: Set<string>;
  finaleStarted: boolean;
  usage: ReadonlyMap<string, number>;
  recent: readonly string[];
  beatInterval: number | null;
  timingProfiles?: ProductTimingProfiles;
  constraints: PromptConstraints;
  layerIndex: number;
  targetPriceCents: number | null;
}): ProductInfo[] {
  const { catalogue, direction, moment, emphasis, preferBed, reserved, usage, recent } = params;
  const totalUses = [...usage.values()].reduce((sum, value) => sum + value, 0);
  const averageUses = totalUses / Math.max(1, catalogue.length);
  const role = direction.role;
  let targetSize = TARGET_SIZE[role];
  if (role === 'build') targetSize = 0.35 + 0.45 * moment.progress;
  if (emphasis === 'peak') targetSize = 1;
  else if (emphasis === 'accent') targetSize = Math.min(1, targetSize + 0.15);
  if (!params.constraints.varietyExempt) {
    targetSize = Math.max(
      0,
      Math.min(1, targetSize + ((params.layerIndex % 3) - 1) * HEIGHT_LAYER_SPREAD),
    );
  }
  const heroes = new Set(direction.heroProductIds);
  const familyUsage = new Map<EffectFamily, number>();
  const familyProductCount = new Map<EffectFamily, number>();
  for (const info of catalogue) {
    for (const family of info.effects) {
      familyProductCount.set(family, (familyProductCount.get(family) ?? 0) + 1);
      familyUsage.set(family, (familyUsage.get(family) ?? 0) + (usage.get(info.product.id) ?? 0));
    }
  }
  const shareScale = role === 'peak' || role === 'finale' ? PEAK_SHARE_MULTIPLIER : 1;

  const scored = catalogue.map((info) => {
    const id = info.product.id;
    let score = 0;
    if (direction.palette.length) {
      const matches = direction.palette.filter((colour) => info.colours.has(colour)).length;
      score += matches > 0 ? 1.2 + 0.4 * Math.min(2, matches - 1) : info.colours.size ? -1 : 0;
    }
    if (direction.effects.some((effect) => info.effects.has(effect))) score += 1.1;
    score -= 2 * Math.abs(info.size - targetSize);
    if (params.constraints.requestedProductIds?.includes(id)) score += REQUESTED_PRODUCT_BONUS;
    if (heroes.has(id) && (moment.kind !== 'pulse' || emphasis !== 'normal')) score += 2.5;
    if (reserved.has(id) && !params.finaleStarted && moment.kind !== 'hit') score -= 2;
    if (info.ground) score += role === 'lull' || role === 'opener' || role === 'outro' ? 0.6 : -1.5;
    const recentIndex = recent.indexOf(id);
    if (recentIndex === 0) score -= 3;
    else if (recentIndex > 0) score -= 1.2 / recentIndex;
    if (!params.constraints.varietyExempt) {
      score -= 0.35 * Math.max(0, (usage.get(id) ?? 0) - averageUses);
      const denominator = Math.max(1, totalUses + 1);
      const productTarget = Math.max(PRODUCT_SHARE_TARGET * shareScale, 1 / catalogue.length);
      score -=
        SHARE_PENALTY_WEIGHT *
        Math.max(0, ((usage.get(id) ?? 0) + 1) / denominator - productTarget);
      for (const family of info.effects) {
        const unavoidable = familyProductCount.get(family) === catalogue.length;
        const target = unavoidable ? 1 : EFFECT_FAMILY_SHARE_TARGET * shareScale;
        score -=
          SHARE_PENALTY_WEIGHT *
          Math.max(0, ((familyUsage.get(family) ?? 0) + 1) / denominator - target);
      }
    }
    if (info.multishot && !preferBed)
      score -= moment.kind === 'pulse' ? MULTISHOT_PULSE_PENALTY : MULTISHOT_PHRASE_PENALTY;
    if (params.targetPriceCents && info.product.minPriceCents) {
      // A healthy budget can pay for character instead of maximising cheap shells.
      score -= Math.min(
        MAX_PRICE_PREFERENCE_PENALTY,
        Math.abs(Math.log(info.product.minPriceCents / params.targetPriceCents)),
      );
    }
    if (preferBed && info.multishot) {
      const cadence = cadenceCompatibility(
        params.timingProfiles?.get(id)?.[emphasis],
        params.beatInterval,
      );
      score += 2 + (cadence ?? 0.5);
    }
    return { info, score };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.info.product.id.localeCompare(b.info.product.id))
    .map((entry) => entry.info);
}

/**
 * Requested colours, effects and multishots are hard constraints. When a
 * requirement is missing, swap it into the most suitable ordinary cue.
 */
function ensurePromptRequirements(params: {
  cues: PlannedCue[];
  slots: CueSlot[];
  catalogue: ProductInfo[];
  constraints: PromptConstraints;
  timingProfiles?: ProductTimingProfiles;
  maxTubes: 1 | 2 | 3;
  songDuration: number;
  budgetCents?: number | null;
}): PlannedCue[] {
  const { cues, slots, catalogue, constraints } = params;
  const byId = new Map(catalogue.map((info) => [info.product.id, info]));
  const used = () => cues.map((cue) => byId.get(cue.productId)).filter((info) => info != null);
  const requirements: Array<(info: ProductInfo) => boolean> = [
    ...(constraints.requestedProductIds ?? []).map(
      (id) => (info: ProductInfo) => info.product.id === id,
    ),
    ...constraints.requiredColours.map((colour) => (info: ProductInfo) => info.colours.has(colour)),
    ...constraints.requestedEffects.map(
      (effect) => (info: ProductInfo) => info.effects.has(effect),
    ),
    ...(constraints.multishots === 'required' ? [(info: ProductInfo) => info.multishot] : []),
  ];
  for (const satisfies of requirements) {
    if (used().some(satisfies)) continue;
    const candidates = catalogue.filter(satisfies);
    // Replace the latest-placed normal cue whose position still works.
    for (let index = cues.length - 1; index >= 0; index -= 1) {
      const cue = cues[index];
      const slot = slots[cue.slotIndex];
      if (!cue || !slot || cue.emphasis === 'peak') continue;
      const replacement = candidates
        .map((info) => ({
          info,
          timing: scheduleProductForCueSlot({
            product: info.product,
            emphasis: cue.emphasis,
            targetTimeSeconds: slot.time,
            timingProfile: params.timingProfiles?.get(info.product.id)?.[cue.emphasis],
          }),
        }))
        .find(
          ({ info, timing }) =>
            timing != null &&
            timing.impactTimeSeconds <= params.songDuration &&
            timing.launchTimeSeconds +
              (params.timingProfiles?.get(info.product.id)?.[cue.emphasis]
                ?.lastImpactOffsetSeconds ?? 0) <=
              params.songDuration &&
            (params.budgetCents == null ||
              cues.reduce(
                (sum, selected) => sum + (byId.get(selected.productId)?.product.minPriceCents ?? 0),
                0,
              ) -
                (byId.get(cue.productId)?.product.minPriceCents ?? 0) +
                (info.product.minPriceCents ?? 0) <=
                params.budgetCents) &&
            occupiedLaunchPositions(info.product, cue.tube, params.maxTubes)?.length === 1 &&
            !cues.some(
              (other) =>
                other !== cue &&
                other.tube === cue.tube &&
                Math.abs(other.timeSeconds - timing.launchTimeSeconds) <
                  GENERATED_LAUNCH_INTERVAL_SECONDS,
            ),
        );
      if (!replacement?.timing) continue;
      cues[index] = {
        ...cue,
        productId: replacement.info.product.id,
        description: replacement.info.product.name,
        timeSeconds: replacement.timing.launchTimeSeconds,
        impactTimeSeconds: replacement.timing.impactTimeSeconds,
        liftTimeSeconds: replacement.timing.liftTimeSeconds,
      };
      break;
    }
  }
  return cues;
}

function overlapsIgnition(
  candidate: { start: number; end: number; tube: Tube },
  accepted: ReadonlyArray<{ start: number; end: number; tube: Tube }>,
): boolean {
  return accepted.some(
    (other) =>
      other.tube === candidate.tube && candidate.start < other.end && other.start < candidate.end,
  );
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}
