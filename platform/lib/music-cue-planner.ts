import { safeParseFireworkSpec } from "@/lib/fireworks/spec";
import type {
  AnalyzerBuildup,
  AnalyzerFireworkCue,
  AnalyzerKeyMoment,
  AnalyzerResult,
  AnalyzerSection,
} from "@/lib/show-analysis.types";

export type CompactPayload = {
  derived?: {
    finale_window?: { start: number; end: number } | null;
    anchor_windows?: Array<{
      type?: string;
      anchor_time?: number;
      start?: number;
      end?: number;
      energy?: number;
      energy_rise?: number;
    }>;
  };
  firework_cue_samples?: AnalyzerFireworkCue[];
  show_personality?: {
    density_level?: string;
  };
};

export type MusicCueProductShot = {
  shotIndex: number;
  timeOffsetSeconds: number;
  effectName: string | null;
  effectType: string | null;
  effectDescription: string | null;
  effectDurationSeconds: number | null;
  heightMeters: number | null;
  specJson: unknown;
};

export type MusicCueProductInput = {
  id: string;
  name: string;
  partNumber: string;
  subtype: string | null;
  description: string | null;
  durationSeconds: number | null;
  priceCents: number | null;
  quantityOnHand: number | null;
  shots: MusicCueProductShot[];
};

export type PlannedShowCue = {
  timeSeconds: number;
  productId: string;
  description: string;
  launchPositionIndex: number;
  seedOverride: number;
};

type CandidateCue = {
  time: number;
  effect: string;
  reason: string;
  energy: number;
  section: string | null;
  height: string | null;
  density: string | null;
  priority: number;
};

type ProductProfile = MusicCueProductInput & {
  duration: number;
  searchText: string;
  shotCount: number;
  maxHeightMeters: number | null;
  shellTypes: string[];
  hasCrackle: boolean;
};

type PlanInput = {
  analysis: AnalyzerResult;
  compactPayload?: CompactPayload | null;
  products: MusicCueProductInput[];
  budgetCents: number | null;
  durationSeconds: number | null;
  brief?: string | null;
};

type PlanResult = {
  cues: PlannedShowCue[];
  targetCount: number;
  skippedReason?: string;
};

const GENERATED_DESCRIPTION_LIMIT = 180;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTime(value: unknown, duration: number): number | null {
  const time = finiteNumber(value);
  if (time == null) return null;
  return clamp(time, 0, Math.max(0, duration - 0.2));
}

function sectionForTime(sections: AnalyzerSection[], time: number): string | null {
  const match = sections.find((section) => time >= section.start && time <= section.end);
  return match?.label ?? null;
}

function sectionIntensityEnergy(section: AnalyzerSection | undefined): number {
  if (!section) return 0.5;
  if (section.intensity === "high") return 0.85;
  if (section.intensity === "low") return 0.3;
  return 0.58;
}

function cuePriority(cue: Omit<CandidateCue, "priority">): number {
  const reason = cue.reason.toLowerCase();
  const effect = cue.effect.toLowerCase();
  const section = cue.section?.toLowerCase() ?? "";
  let score = cue.energy * 4;
  if (reason.includes("finale")) score += 4;
  if (reason.includes("climax")) score += 3;
  if (reason.includes("build")) score += 1.8;
  if (effect.includes("barrage")) score += 2.2;
  if (effect.includes("accent")) score += 0.8;
  if (section.includes("chorus") || section.includes("drop")) score += 1.2;
  if (section.includes("outro")) score += 1;
  if (cue.height === "high") score += 0.6;
  if (cue.density === "dense") score += 0.6;
  return score;
}

function buildCandidate(partial: Omit<CandidateCue, "priority">): CandidateCue {
  return {
    ...partial,
    priority: cuePriority(partial),
  };
}

function normalizeAnalyzerCue(
  cue: AnalyzerFireworkCue,
  sections: AnalyzerSection[],
  duration: number,
): CandidateCue | null {
  const time = normalizeTime(cue.time, duration);
  if (time == null) return null;
  const effect = cue.effect?.trim() || "accent";
  const reason = cue.reason?.trim() || "analysis anchor";
  const energy = clamp(finiteNumber(cue.energy) ?? 0.55, 0, 1);
  return buildCandidate({
    time,
    effect,
    reason,
    energy,
    section: cue.section || sectionForTime(sections, time),
    height: cue.height ?? null,
    density: cue.density ?? null,
  });
}

function cueFromMoment(
  moment: AnalyzerKeyMoment,
  sections: AnalyzerSection[],
  duration: number,
): CandidateCue | null {
  const time = normalizeTime(moment.time, duration);
  if (time == null) return null;
  const effect = moment.type === "climax" ? "barrage" : "accent";
  return buildCandidate({
    time,
    effect,
    reason: moment.type,
    energy: clamp(moment.energy, 0, 1),
    section: sectionForTime(sections, time),
    height: moment.type === "climax" ? "high" : "medium",
    density: moment.type === "climax" ? "dense" : "medium",
  });
}

function cueFromBuildup(
  buildup: AnalyzerBuildup,
  sections: AnalyzerSection[],
  duration: number,
): CandidateCue | null {
  const time = normalizeTime(buildup.peak, duration);
  if (time == null) return null;
  return buildCandidate({
    time,
    effect: "accent",
    reason: "build-up peak",
    energy: clamp(0.45 + buildup.energy_rise, 0, 1),
    section: sectionForTime(sections, time),
    height: "medium",
    density: "medium",
  });
}

function sectionCues(sections: AnalyzerSection[], duration: number): CandidateCue[] {
  return sections
    .filter((section) => section.duration >= 8)
    .flatMap((section) => {
      const cues: CandidateCue[] = [];
      const sectionEnergy = sectionIntensityEnergy(section);
      const start = normalizeTime(section.start + Math.min(2, section.duration * 0.12), duration);
      const exit = normalizeTime(section.end - Math.min(2, section.duration * 0.1), duration);
      if (start != null && section.intensity !== "low") {
        cues.push(
          buildCandidate({
            time: start,
            effect: section.intensity === "high" ? "accent" : "single",
            reason: `${section.label} entry`,
            energy: sectionEnergy,
            section: section.label,
            height: section.intensity === "high" ? "medium" : "low",
            density: section.intensity === "high" ? "medium" : "sparse",
          }),
        );
      }
      if (exit != null) {
        cues.push(
          buildCandidate({
            time: exit,
            effect: section.intensity === "high" ? "barrage" : "accent",
            reason: `${section.label} exit`,
            energy: sectionEnergy,
            section: section.label,
            height: section.intensity === "high" ? "high" : "medium",
            density: section.intensity === "high" ? "dense" : "medium",
          }),
        );
      }
      return cues;
    });
}

function energyFallbackCues(analysis: AnalyzerResult, duration: number): CandidateCue[] {
  const points = analysis.energy_timeline
    .map((point) => {
      const time = normalizeTime(point.time, duration);
      const energy = finiteNumber(point.energy);
      return time == null || energy == null
        ? null
        : { time, energy: clamp(energy, 0, 1) };
    })
    .filter((point): point is { time: number; energy: number } => point != null);
  if (points.length === 0) return [];

  const localPeaks = points.filter((point, index) => {
    const previous = points[index - 1]?.energy ?? -1;
    const next = points[index + 1]?.energy ?? -1;
    return point.energy >= previous && point.energy >= next;
  });
  const source = localPeaks.length >= 3 ? localPeaks : points;
  const targetFallbacks = clamp(Math.round(duration / 25), 4, 12);
  const minimumSpacing = clamp(duration / Math.max(targetFallbacks, 1) * 0.45, 5, 12);
  const accepted: Array<{ time: number; energy: number }> = [];

  for (const point of [...source].sort((a, b) => b.energy - a.energy)) {
    if (accepted.length >= targetFallbacks) break;
    const tooClose = accepted.some((acceptedPoint) => {
      return Math.abs(acceptedPoint.time - point.time) < minimumSpacing;
    });
    if (!tooClose) accepted.push(point);
  }

  return accepted
    .sort((a, b) => a.time - b.time)
    .map((point) =>
      buildCandidate({
        time: point.time,
        effect: point.energy >= 0.82 ? "barrage" : "accent",
        reason: "energy peak",
        energy: point.energy,
        section: sectionForTime(analysis.sections, point.time),
        height: point.energy >= 0.82 ? "high" : "medium",
        density: point.energy >= 0.72 ? "dense" : "medium",
      }),
    );
}

function compactAnchorCues(
  compactPayload: CompactPayload | null | undefined,
  sections: AnalyzerSection[],
  duration: number,
): CandidateCue[] {
  const windows = compactPayload?.derived?.anchor_windows ?? [];
  return windows
    .map((window) => {
      const time = normalizeTime(window.anchor_time, duration);
      if (time == null) return null;
      const isClimax = window.type === "climax";
      return buildCandidate({
        time,
        effect: isClimax ? "barrage" : "accent",
        reason: isClimax ? "climax window" : "build-up window",
        energy: clamp(window.energy ?? window.energy_rise ?? 0.62, 0, 1),
        section: sectionForTime(sections, time),
        height: isClimax ? "high" : "medium",
        density: isClimax ? "dense" : "medium",
      });
    })
    .filter((cue): cue is CandidateCue => cue != null);
}

function dedupeCandidates(candidates: CandidateCue[]): CandidateCue[] {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const accepted: CandidateCue[] = [];
  for (const candidate of sorted) {
    const near = accepted.find((cue) => Math.abs(cue.time - candidate.time) < 1.25);
    if (!near) {
      accepted.push(candidate);
    }
  }
  return accepted;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function targetCueCount(
  duration: number,
  budgetCents: number | null,
  products: ProductProfile[],
  densityLevel: string | undefined,
  brief: string | null | undefined,
): number {
  const base = clamp(Math.round(duration / 12), 8, 28);
  const densityAdjustment =
    densityLevel === "high" ? 4 : densityLevel === "low" ? -3 : 0;
  const briefText = brief?.toLowerCase() ?? "";
  const briefAdjustment =
    /intense|dense|more|big|finale/.test(briefText)
      ? 3
      : /sparse|minimal|less|avoid overfill|restrained/.test(briefText)
        ? -3
        : 0;
  const durationTarget = clamp(base + densityAdjustment + briefAdjustment, 6, 32);
  if (!budgetCents || budgetCents <= 0) return durationTarget;

  const productPrices = products
    .map((product) => product.priceCents)
    .filter((price): price is number => typeof price === "number" && price > 0);
  const medianPrice = median(productPrices) ?? 5000;
  const budgetTarget = clamp(Math.floor(budgetCents / Math.max(medianPrice, 3000)), 5, 36);
  return Math.min(durationTarget, budgetTarget);
}

function selectCandidates(
  candidates: CandidateCue[],
  targetCount: number,
  duration: number,
): CandidateCue[] {
  const unique = dedupeCandidates(candidates);
  const minSpacing = clamp((duration / Math.max(targetCount, 1)) * 0.45, 3.5, 8);
  const selected: CandidateCue[] = [];

  for (const spacing of [minSpacing, minSpacing * 0.65, minSpacing * 0.35]) {
    for (const candidate of unique) {
      if (selected.length >= targetCount) break;
      if (selected.includes(candidate)) continue;
      const tooClose = selected.some((cue) => Math.abs(cue.time - candidate.time) < spacing);
      if (!tooClose) selected.push(candidate);
    }
    if (selected.length >= targetCount) break;
  }

  return selected.sort((a, b) => a.time - b.time);
}

function buildProductProfile(product: MusicCueProductInput): ProductProfile {
  let maxHeightMeters: number | null = null;
  let maxShotEnd = 0;
  const shellTypes: string[] = [];
  let hasCrackle = false;

  for (const shot of product.shots) {
    const spec = safeParseFireworkSpec(shot.specJson);
    shellTypes.push(spec.shellType);
    if (spec.crackle || spec.trailEffect === "crackle" || spec.shellType === "crackle") {
      hasCrackle = true;
    }
    const shotHeight = shot.heightMeters ?? spec.launch?.heightMeters ?? null;
    if (shotHeight != null) {
      maxHeightMeters = Math.max(maxHeightMeters ?? 0, shotHeight);
    }
    const shotDuration = shot.effectDurationSeconds ?? 0;
    maxShotEnd = Math.max(maxShotEnd, shot.timeOffsetSeconds + shotDuration);
  }

  const duration = Math.max(product.durationSeconds ?? maxShotEnd, maxShotEnd, 0.75);
  const text = [
    product.name,
    product.partNumber,
    product.subtype,
    product.description,
    ...product.shots.flatMap((shot) => [
      shot.effectName,
      shot.effectType,
      shot.effectDescription,
    ]),
    ...shellTypes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    ...product,
    duration,
    searchText: text,
    shotCount: Math.max(product.shots.length, 1),
    maxHeightMeters,
    shellTypes,
    hasCrackle,
  };
}

function textMatches(product: ProductProfile, terms: string[]): boolean {
  return terms.some((term) => product.searchText.includes(term));
}

function scoreProductForCue(
  product: ProductProfile,
  cue: CandidateCue,
  usageCount: number,
  remainingBudgetCents: number | null,
): number {
  const effect = cue.effect.toLowerCase();
  let score = 0;

  if (effect.includes("barrage")) {
    if (product.shotCount > 1) score += 5;
    if (textMatches(product, ["cake", "barrage", "finale", "multi", "compound"])) score += 4;
    if ((product.maxHeightMeters ?? 0) >= 35) score += 1.5;
  } else if (effect.includes("crackle")) {
    if (product.hasCrackle || textMatches(product, ["crackle", "crackling"])) score += 7;
  } else if (effect.includes("single")) {
    if (product.shotCount === 1) score += 4;
    if (textMatches(product, ["comet", "mine", "candle", "single", "fountain"])) score += 2;
    if ((product.maxHeightMeters ?? 0) <= 35) score += 1;
  } else {
    if (textMatches(product, ["comet", "mine", "willow", "peony", "chrysanthemum", "palm"])) {
      score += 2;
    }
    if (product.shotCount <= 8) score += 1;
  }

  if (cue.height === "high" && (product.maxHeightMeters ?? 0) >= 35) score += 2;
  if (cue.height === "low" && (product.maxHeightMeters ?? 999) <= 35) score += 1.5;
  if (cue.energy >= 0.78 && product.shotCount > 1) score += 1.5;
  if (cue.energy < 0.45 && product.shotCount === 1) score += 1.2;
  if ((product.quantityOnHand ?? 1) > 0) score += 0.75;
  if ((product.priceCents ?? 0) > 0) score += 0.4;

  if (
    remainingBudgetCents != null &&
    product.priceCents != null &&
    product.priceCents > remainingBudgetCents
  ) {
    score -= 5;
  }

  score -= usageCount * 0.9;
  score -= Math.max(0, product.duration - 12) * 0.04;
  return score;
}

function pickProduct(
  cue: CandidateCue,
  products: ProductProfile[],
  usage: Map<string, number>,
  remainingBudgetCents: number | null,
): ProductProfile | null {
  let best: ProductProfile | null = null;
  let bestScore = -Infinity;
  for (const product of products) {
    const score = scoreProductForCue(
      product,
      cue,
      usage.get(product.id) ?? 0,
      remainingBudgetCents,
    );
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }
  return best;
}

function chooseLaunchPosition(
  cue: CandidateCue,
  product: ProductProfile,
  tubeUntil: number[],
  cueIndex: number,
): number | null {
  const preferred =
    cue.effect.toLowerCase().includes("barrage") || cue.energy >= 0.8
      ? [1, 0, 2]
      : [cueIndex % 3, (cueIndex + 1) % 3, (cueIndex + 2) % 3];
  for (const index of preferred) {
    if (cue.time >= tubeUntil[index] - 0.05) {
      tubeUntil[index] = cue.time + product.duration;
      return index;
    }
  }
  return null;
}

function cueDescription(cue: CandidateCue, product: ProductProfile): string {
  const section = cue.section ? `${cue.section} ` : "";
  const reason = cue.reason.replace(/[-_]/g, " ");
  const base = `${section}${reason}: ${product.name}`;
  return base.length <= GENERATED_DESCRIPTION_LIMIT
    ? base
    : `${base.slice(0, GENERATED_DESCRIPTION_LIMIT - 1).trim()}...`;
}

function stableSeed(time: number, productId: string, index: number): number {
  let seed = Math.round(time * 1000) + index * 1009;
  for (let i = 0; i < productId.length; i++) {
    seed = (seed * 31 + productId.charCodeAt(i)) >>> 0;
  }
  return seed % 2147483647;
}

export function planMusicAnalysisCues(input: PlanInput): PlanResult {
  const duration =
    finiteNumber(input.analysis.duration_seconds) ??
    input.durationSeconds ??
    180;
  const products = input.products
    .map(buildProductProfile)
    .filter((product) => product.shots.length > 0);

  if (products.length === 0) {
    return { cues: [], targetCount: 0, skippedReason: "No firework products are available." };
  }

  const candidates = [
    ...(input.analysis.firework_cues ?? [])
      .map((cue) => normalizeAnalyzerCue(cue, input.analysis.sections, duration))
      .filter((cue): cue is CandidateCue => cue != null),
    ...(input.compactPayload?.firework_cue_samples ?? [])
      .map((cue) => normalizeAnalyzerCue(cue, input.analysis.sections, duration))
      .filter((cue): cue is CandidateCue => cue != null),
    ...input.analysis.key_moments
      .map((moment) => cueFromMoment(moment, input.analysis.sections, duration))
      .filter((cue): cue is CandidateCue => cue != null),
    ...input.analysis.buildups
      .map((buildup) => cueFromBuildup(buildup, input.analysis.sections, duration))
      .filter((cue): cue is CandidateCue => cue != null),
    ...compactAnchorCues(input.compactPayload, input.analysis.sections, duration),
    ...sectionCues(input.analysis.sections, duration),
    ...energyFallbackCues(input.analysis, duration),
  ];

  const densityLevel =
    input.analysis.show_personality?.density_level ??
    input.compactPayload?.show_personality?.density_level;
  const targetCount = targetCueCount(
    duration,
    input.budgetCents,
    products,
    densityLevel,
    input.brief,
  );
  const selected = selectCandidates(candidates, targetCount, duration);
  const usage = new Map<string, number>();
  const tubeUntil = [0, 0, 0];
  let remainingBudgetCents = input.budgetCents;
  const planned: PlannedShowCue[] = [];

  for (const cue of selected) {
    const product = pickProduct(cue, products, usage, remainingBudgetCents);
    if (!product) continue;
    if (
      remainingBudgetCents != null &&
      product.priceCents != null &&
      product.priceCents > remainingBudgetCents &&
      planned.length >= 4
    ) {
      continue;
    }
    const launchPositionIndex = chooseLaunchPosition(cue, product, tubeUntil, planned.length);
    if (launchPositionIndex == null) continue;

    planned.push({
      timeSeconds: Number(cue.time.toFixed(2)),
      productId: product.id,
      description: cueDescription(cue, product),
      launchPositionIndex,
      seedOverride: stableSeed(cue.time, product.id, planned.length),
    });
    usage.set(product.id, (usage.get(product.id) ?? 0) + 1);
    if (remainingBudgetCents != null && product.priceCents != null) {
      remainingBudgetCents -= product.priceCents;
    }
  }

  return { cues: planned, targetCount };
}
