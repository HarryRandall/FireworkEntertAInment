/**
 * Beat-aligned cue slot grid generation (server-only).
 *
 * Given an analyser result (beats, sections, key moments) we produce a fixed
 * number of {@link CueSlot}s spread across three launch tubes. The grid is
 * deterministic given the same analyser input so re-running cue generation
 * never reshuffles slot timing.
 *
 * Consumed by the cue-generation pipeline in `lib/cue-generation/`.
 */
import 'server-only';

import type {
  AnalyserBuildup,
  AnalyserKeyMoment,
  AnalyserResult,
  AnalyserSection,
} from '@/lib/show-analysis.types';

export type SlotVibe =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'drop'
  | 'bridge'
  | 'buildup'
  | 'outro';

export type SlotEmphasis = 'normal' | 'accent' | 'peak';

export type CueSlot = {
  index: number;
  time: number; // seconds, millisecond precision
  tube: 0 | 1 | 2;
  intensity: number; // 0..1
  sectionLabel: string;
  vibe: SlotVibe;
  nearClimax: boolean;
  /** True when the slot lands on a detected bar downbeat. */
  isDownbeat: boolean;
  /** Beat-in-bar position (0 = downbeat), or -1 for a non-beat onset accent. */
  barPosition: number;
  /** Render + product-size emphasis derived from musical importance. */
  emphasis: SlotEmphasis;
  /** True when the slot falls inside the analyser's finale window. */
  finale: boolean;
};

const TARGET_SLOTS = 160;
const MAX_TARGET_SLOTS = 220;
const MIN_INTENSITY = 0.1;
const WINDOW_COUNT = 12;
/** Under the cap, every passage reserves one firing beat per this many seconds. */
const COVERAGE_FLOOR_SECONDS = 5;
/** Gaps wider than this are closed before the remaining cap goes to the strongest beats. */
const MAX_COVERAGE_GAP_SECONDS = 6;
/** Climax-adjacent beats further apart than this belong to separate runs. */
const CLIMAX_RUN_GAP_SECONDS = 1.5;
/** Share of the cap held back from the passage shares so gap repair has room. */
const GAP_REPAIR_RESERVE_SHARE = 0.04;
/** A near-silent passage still earns a little of the cap above its coverage floor. */
const MIN_SLOT_WEIGHT = 0.02;
/** Choruses and drops earn more of the cap than an equally loud verse. */
const CHORUS_SLOT_WEIGHT = 1.35;
/** The finale window earns more than the body even when it is not labelled a chorus. */
const FINALE_SLOT_WEIGHT = 1.2;

/** Map an analyser section label to the vibe planners reason about. */
export function vibeForSectionLabel(label: string): SlotVibe {
  const l = label.toLowerCase();
  if (l.includes('chorus') && l.includes('pre')) return 'pre-chorus';
  if (l.includes('chorus')) return 'chorus';
  if (l.includes('drop')) return 'drop';
  if (l.includes('verse')) return 'verse';
  if (l.includes('bridge') || l.includes('breakdown')) return 'bridge';
  if (l.includes('build') || l.includes('rise')) return 'buildup';
  if (l.includes('intro') || l.includes('opening')) return 'intro';
  if (l.includes('outro') || l.includes('end') || l.includes('finale')) return 'outro';
  return 'verse';
}

function vibeBoost(vibe: SlotVibe): number {
  switch (vibe) {
    case 'chorus':
    case 'drop':
      return 0.36;
    case 'pre-chorus':
    case 'buildup':
      return 0.24;
    case 'bridge':
      return 0.05;
    case 'verse':
      return 0;
    case 'intro':
    case 'outro':
      return -0.06;
  }
}

/** A beat scored with musical context, ahead of tube expansion. */
type Scored = {
  time: number;
  intensity: number;
  sectionLabel: string;
  vibe: SlotVibe;
  nearClimax: boolean;
  isDownbeat: boolean;
  barPosition: number;
  emphasis: SlotEmphasis;
  finale: boolean;
};

function sectionAt(t: number, sections: AnalyserSection[]): AnalyserSection | undefined {
  return sections.find((s) => t >= s.start && t < s.end);
}

/** Base energy plus key-moment and buildup-ramp boosts, in analyser order. */
function intensityAt(
  t: number,
  section: AnalyserSection | undefined,
  vibe: SlotVibe,
  keyMoments: AnalyserKeyMoment[],
  buildups: AnalyserBuildup[],
): { intensity: number; nearClimax: boolean } {
  const base = clamp01(section?.avg_energy ?? 0.45);
  const labelBoost = section?.intensity === 'high' ? 0.2 : section?.intensity === 'low' ? -0.15 : 0;
  let intensity = base + labelBoost + vibeBoost(vibe);

  let nearClimax = false;
  for (const m of keyMoments) {
    const dt = Math.abs(m.time - t);
    if (dt < 1.5) {
      intensity += m.type === 'climax' ? 0.3 : 0.15;
      if (m.type === 'climax') nearClimax = true;
    }
  }

  for (const b of buildups) {
    if (b.peak <= b.start) continue;
    if (t >= b.start && t <= b.peak) {
      const progress = (t - b.start) / (b.peak - b.start);
      const ramp = 0.4 + 0.55 * progress;
      intensity = Math.max(intensity, ramp);
    }
  }

  return { intensity, nearClimax };
}

/**
 * Bar-in-progress cursor for downbeat-relative positioning. Mutated in beat
 * order, so callers must score beats sequentially with the same cursor.
 */
function barPositionAt(
  isDownbeat: boolean,
  barCursor: { value: number },
  beatsPerBar: number,
): number {
  if (isDownbeat) {
    barCursor.value = 1;
    return 0;
  }
  const barPosition = barCursor.value;
  barCursor.value = (barCursor.value + 1) % beatsPerBar;
  return barPosition;
}

function emphasisAt(params: {
  nearClimax: boolean;
  atBuildupPeak: boolean;
  finale: boolean;
  isDownbeat: boolean;
  vibe: SlotVibe;
}): SlotEmphasis {
  const { nearClimax, atBuildupPeak, finale, isDownbeat, vibe } = params;
  if (nearClimax || atBuildupPeak) return 'peak';
  if (finale && isDownbeat && (vibe === 'chorus' || vibe === 'drop')) return 'peak';
  if (
    isDownbeat &&
    (vibe === 'chorus' || vibe === 'drop' || vibe === 'buildup' || vibe === 'pre-chorus')
  ) {
    return 'accent';
  }
  if (finale && isDownbeat) return 'accent';
  return 'normal';
}

type BeatScoringContext = {
  sections: AnalyserSection[];
  keyMoments: AnalyserKeyMoment[];
  buildups: AnalyserBuildup[];
  buildupPeaks: number[];
  hasDownbeats: boolean;
  nearDownbeat: (t: number) => boolean;
  beatsPerBar: number;
  inFinale: (t: number) => boolean;
};

/** Scores one beat's musical context. Must be called in beat-time order. */
function scoreBeatAt(
  t: number,
  i: number,
  ctx: BeatScoringContext,
  barCursor: { value: number },
): Scored {
  const section = sectionAt(t, ctx.sections);
  const sectionLabel = section?.label ?? 'unknown';
  const vibe = vibeForSectionLabel(sectionLabel);
  const { intensity, nearClimax } = intensityAt(t, section, vibe, ctx.keyMoments, ctx.buildups);

  const isDownbeat = ctx.hasDownbeats ? ctx.nearDownbeat(t) : i % ctx.beatsPerBar === 0;
  const barPosition = barPositionAt(isDownbeat, barCursor, ctx.beatsPerBar);

  const finale = ctx.inFinale(t);
  const atBuildupPeak = ctx.buildupPeaks.some((p) => Math.abs(p - t) <= 0.25);
  const emphasis = emphasisAt({ nearClimax, atBuildupPeak, finale, isDownbeat, vibe });

  return {
    time: t,
    intensity: clamp01(intensity),
    sectionLabel,
    vibe,
    nearClimax,
    isDownbeat,
    barPosition,
    emphasis,
    finale,
  };
}

/** Tube count for one beat, capped by the site's launch-position width. */
function tubesForBeat(beat: Scored, maxTubes: 1 | 2 | 3): number {
  if (beat.emphasis === 'peak') return maxTubes;
  return Math.min(tubeCountForBeat(beat), maxTubes);
}

/**
 * Chorus/drop beats, climaxes, and (with a bar grid) every downbeat fire in
 * full; everything else is fill texture toward the target slot count.
 */
function selectSampledBeats(
  live: Scored[],
  maxTubes: 1 | 2 | 3,
  hasDownbeats: boolean,
  songDuration: number,
): Scored[] {
  const isMustKeep = (b: Scored) =>
    b.emphasis === 'peak' ||
    b.vibe === 'chorus' ||
    b.vibe === 'drop' ||
    b.nearClimax ||
    (hasDownbeats && b.isDownbeat);
  const isFillEligible = (b: Scored) => {
    if (isMustKeep(b)) return false;
    if (!hasDownbeats) return true; // 1.3.0: original windowed fill everywhere.
    // With a bar grid, sparse sections are represented by their downbeats;
    // only allow off-beat fill in build/bridge sections to shape ramps.
    return b.vibe === 'buildup' || b.vibe === 'pre-chorus' || b.vibe === 'bridge';
  };

  const fullCoverage = live.filter(isMustKeep);
  const sampled: Scored[] = [...fullCoverage];
  let sampledSlotCount = fullCoverage.reduce(
    (total, beat) => total + tubesForBeat(beat, maxTubes),
    0,
  );
  const remainingTarget = Math.max(0, TARGET_SLOTS - sampledSlotCount);

  if (remainingTarget > 0) {
    const sampledBeatKeys = new Set(fullCoverage.map(beatKey));
    const sampledCandidates = live.filter(
      (b) => !sampledBeatKeys.has(beatKey(b)) && isFillEligible(b),
    );

    // Keep coverage across the whole song by bucketing into windows and
    // taking the strongest eligible beats in each window.
    const windowSize = songDuration / WINDOW_COUNT;
    const buckets: Scored[][] = Array.from({ length: WINDOW_COUNT }, () => []);
    for (const b of sampledCandidates) {
      const idx = Math.min(WINDOW_COUNT - 1, Math.floor(b.time / windowSize));
      buckets[idx].push(b);
    }
    for (const bucket of buckets) {
      bucket.sort((a, b) => b.intensity - a.intensity);
    }

    let madeProgress = true;
    while (sampledSlotCount < TARGET_SLOTS && madeProgress) {
      madeProgress = false;
      for (const bucket of buckets) {
        const candidate = bucket.shift();
        if (!candidate) continue;
        const candidateSlotCount = tubesForBeat(candidate, maxTubes);
        if (sampledSlotCount + candidateSlotCount > MAX_TARGET_SLOTS) continue;
        sampled.push(candidate);
        sampledSlotCount += candidateSlotCount;
        madeProgress = true;
        if (sampledSlotCount >= TARGET_SLOTS) break;
      }
    }
  }

  sampled.sort((a, b) => a.time - b.time);
  return sampled;
}

/**
 * A few sharp non-beat onset accents inside chorus/drop/high-energy sections,
 * appended (not merged) so callers must re-sort the combined slot list.
 */
function appendOnsetAccentSlots(params: {
  slots: CueSlot[];
  nextIndex: number;
  rotor: 0 | 1 | 2;
  maxTubes: 1 | 2 | 3;
  analysis: AnalyserResult | null;
  sections: AnalyserSection[];
  beats: number[];
  songDuration: number;
  inFinale: (t: number) => boolean;
}): { nextIndex: number; rotor: 0 | 1 | 2 } {
  const { slots, analysis, sections, beats, songDuration, inFinale } = params;
  let { nextIndex, rotor } = params;
  const onsetTimes = (analysis?.onset_times ?? []).filter(
    (t) => Number.isFinite(t) && t >= 0 && t < songDuration,
  );
  if (onsetTimes.length === 0) return { nextIndex, rotor };

  const energyTimeline = analysis?.energy_timeline ?? [];
  const energyAt = (t: number) => {
    let best = 0;
    for (const p of energyTimeline) {
      if (Math.abs(p.time - t) <= 1.0) best = Math.max(best, p.energy);
    }
    return best;
  };
  const isStrongSection = (t: number) => {
    const s = sections.find((sec) => t >= sec.start && t < sec.end);
    if (!s) return false;
    const v = vibeForSectionLabel(s.label);
    return v === 'chorus' || v === 'drop' || s.intensity === 'high';
  };
  const nearBeat = (t: number) => beats.some((b) => Math.abs(b - t) <= 0.08);
  const chosen: number[] = [];
  for (const t of onsetTimes) {
    if (chosen.length >= 12) break;
    if (!isStrongSection(t)) continue;
    if (energyAt(t) < 0.5) continue;
    if (nearBeat(t)) continue;
    if (chosen.some((c) => Math.abs(c - t) < 0.3)) continue;
    chosen.push(Number(t.toFixed(3)));
  }
  for (const t of chosen) {
    const section = sections.find((s) => t >= s.start && t < s.end);
    const vibe = section ? vibeForSectionLabel(section.label) : 'verse';
    slots.push({
      index: nextIndex++,
      time: Number(t.toFixed(3)),
      tube: (rotor % params.maxTubes) as 0 | 1 | 2,
      intensity: 0.6,
      sectionLabel: section?.label ?? 'unknown',
      vibe,
      nearClimax: false,
      isDownbeat: false,
      barPosition: -1,
      emphasis: 'accent',
      finale: inFinale(t),
    });
    rotor = ((rotor + 1) % params.maxTubes) as 0 | 1 | 2;
  }
  return { nextIndex, rotor };
}

export function buildCueSlots(
  analysis: AnalyserResult | null,
  songDuration: number,
  maxTubes: 1 | 2 | 3 = 3,
): CueSlot[] {
  if (!songDuration || songDuration <= 0) return [];
  if (analysis && (!Number.isFinite(analysis.tempo_bpm) || analysis.tempo_bpm <= 0)) return [];

  const sections = analysis?.sections ?? [];
  const buildups = analysis?.buildups ?? [];
  const keyMoments = analysis?.key_moments ?? [];
  const tempoBpm = clampTempo(analysis?.tempo_bpm ?? 120);
  const beatsPerBar = clampBeatsPerBar(analysis?.beats_per_bar ?? 4);
  const finaleWindow = analysis?.derived?.finale_window ?? null;

  // 1. Beat times: prefer AI's, fall back to synthetic from tempo if sparse.
  //    Keep only finite beats inside the song, sorted, with exact duplicates
  //    removed, so a stray analyser value can't place cues before 0 or past the
  //    end of the song.
  const cleanedBeats = (analysis?.beat_times ?? [])
    .filter((t) => Number.isFinite(t) && t >= 0 && t < songDuration)
    .sort((a, b) => a - b);
  let beats = cleanedBeats.filter((t, i) => i === 0 || t !== cleanedBeats[i - 1]);
  if (analysis && beats.length < 2) return [];
  const lastBeat = beats.length ? beats[beats.length - 1] : 0;
  const needsSynth = analysis == null && (beats.length < 20 || lastBeat < songDuration * 0.75);
  if (needsSynth) {
    const interval = 60 / tempoBpm;
    beats = [];
    for (let t = interval; t < songDuration - 0.25; t += interval) {
      beats.push(Number(t.toFixed(3)));
    }
  }

  // Bar / downbeat grid (schema 1.4.0). When the analyser provides downbeats
  // we lock sparse sections to one fire per bar; without downbeats (older
  // 1.3.0 analyses) we fall back to the original every-beat windowed sampling
  // so nothing regresses.
  const downbeatTimes = (analysis?.downbeat_times ?? [])
    .filter((t) => Number.isFinite(t) && t >= 0 && t < songDuration)
    .map((t) => Number(t.toFixed(3)));
  const hasDownbeats = downbeatTimes.length > 0 && !needsSynth;
  const nearDownbeat = (t: number) => downbeatTimes.some((d) => Math.abs(d - t) <= 0.06);

  const finaleStart = finaleWindow?.start ?? null;
  const finaleEnd = finaleWindow?.end ?? null;
  const inFinale = (t: number) =>
    finaleStart != null && finaleEnd != null && t >= finaleStart && t <= finaleEnd;
  const buildupPeaks = buildups.map((b) => b.peak);

  // 2. Score each beat by section + climax proximity + buildup ramp, and tag
  //    it with downbeat / bar / emphasis / finale metadata.
  const scoringContext: BeatScoringContext = {
    sections,
    keyMoments,
    buildups,
    buildupPeaks,
    hasDownbeats,
    nearDownbeat,
    beatsPerBar,
    inFinale,
  };
  const barCursor = { value: 0 };
  const scored: Scored[] = beats.map((t, i) => scoreBeatAt(t, i, scoringContext, barCursor));
  const finalAnalysedBeat = analysis ? scored[scored.length - 1] : undefined;
  if (finalAnalysedBeat) finalAnalysedBeat.emphasis = 'peak';

  // 3. Drop silent stretches. Preserve the final analysed beat even when its
  //    section energy is below the normal live threshold so the show can land
  //    visibly on the song's final musical hit.
  const live = scored.filter((b) => b.intensity > MIN_INTENSITY || b === finalAnalysedBeat);
  if (live.length === 0) return [];

  // 4. Select slots. Must-keep beats: choruses/drops (every beat), climaxes,
  //    and - when we have a bar grid - every downbeat so verses lock to the
  //    bar. Remaining beats fill build/bridge texture toward the target.
  const sampled = selectSampledBeats(live, maxTubes, hasDownbeats, songDuration);

  // 5. Expand into per-tube slots based on intensity. Stagger tubes across
  //    consecutive beats so the same tube doesn't fire back-to-back too often
  //    (single-shot products are short but not zero).
  const slots: CueSlot[] = [];
  let idx = 0;
  let rotor: 0 | 1 | 2 = 0;
  for (const b of sampled) {
    const tubeCount = tubesForBeat(b, maxTubes);
    const tubes: Array<0 | 1 | 2> = [];
    for (let i = 0; i < tubeCount; i++) {
      tubes.push(((rotor + i) % maxTubes) as 0 | 1 | 2);
    }
    rotor = ((rotor + 1) % maxTubes) as 0 | 1 | 2;
    for (const tube of tubes) {
      slots.push({
        index: idx++,
        time: Number(b.time.toFixed(3)),
        tube,
        intensity: Number(b.intensity.toFixed(3)),
        sectionLabel: b.sectionLabel,
        vibe: b.vibe,
        nearClimax: b.nearClimax,
        isDownbeat: b.isDownbeat,
        barPosition: b.barPosition,
        emphasis: b.emphasis,
        finale: b.finale,
      });
    }
  }

  // 6. Onset accents: a few sharp non-beat hits inside chorus/drop/high
  //    sections so snare/kick accents land without cluttering verses.
  ({ nextIndex: idx, rotor } = appendOnsetAccentSlots({
    slots,
    nextIndex: idx,
    rotor,
    maxTubes,
    analysis,
    sections,
    beats,
    songDuration,
    inFinale,
  }));

  // Re-sort after adding interleaved onset accents, then cap whole timestamp
  // groups so a three-tube accent can never be truncated into one or two tubes.
  slots.sort((a, b) => a.time - b.time || a.tube - b.tube);
  const finalAnalysedBeatTime = finalAnalysedBeat
    ? Number(finalAnalysedBeat.time.toFixed(3))
    : null;
  const cappedSlots = capSlotGroups({
    slots,
    maxSlots: MAX_TARGET_SLOTS,
    sections,
    finalAnalysedBeatTime,
    beatsPerBar,
  });
  cappedSlots.forEach((s, i) => (s.index = i));
  return cappedSlots;
}

type SlotGroup = {
  time: number;
  slots: CueSlot[];
  sectionIndex: number;
  nearClimax: boolean;
  peak: boolean;
  finale: boolean;
  downbeat: boolean;
  halfBar: boolean;
  accent: boolean;
  intensity: number;
  /** The beat at the heart of a climax run, or a peak outside any run. */
  climaxCentre: boolean;
};

/** Beats grouped by analysed section, with the share of the cap they earn. */
type SlotBucket = {
  start: number;
  end: number;
  groups: SlotGroup[];
  /** Musical weight: span scaled by how loud and chorus-like the passage is. */
  weight: number;
  /** Every slot the bucket could use. */
  demand: number;
  /** Slots needed to keep the passage covered at the coverage spacing. */
  floor: number;
  budget: number;
};

function compareSlotGroupPriority(a: SlotGroup, b: SlotGroup): number {
  return (
    Number(b.nearClimax) - Number(a.nearClimax) ||
    Number(b.peak) - Number(a.peak) ||
    Number(b.finale) - Number(a.finale) ||
    Number(b.downbeat) - Number(a.downbeat) ||
    Number(b.halfBar) - Number(a.halfBar) ||
    Number(b.accent) - Number(a.accent) ||
    b.intensity - a.intensity ||
    a.time - b.time
  );
}

/**
 * Strong beats come first inside a passage: the climax itself and other
 * peaks, then downbeats and finale beats, then the rest of a climax run,
 * then half-bars, then the remaining fill. Under a tight budget a chorus
 * therefore keeps its bar pulse rather than spending everything on a few
 * seconds of barrage around the climax.
 */
const SLOT_TIERS = 5;

function slotGroupTier(group: SlotGroup): number {
  if (group.climaxCentre || (group.peak && !group.nearClimax)) return 0;
  if (group.downbeat || group.finale) return 1;
  if (group.nearClimax || group.peak) return 2;
  if (group.halfBar) return 3;
  return 4;
}

/** Mark the middle beat of every run of consecutive climax-adjacent groups. */
function markClimaxCentres(groups: SlotGroup[]): void {
  let run: SlotGroup[] = [];
  const close = () => {
    const centre = run[Math.floor((run.length - 1) / 2)];
    if (centre) centre.climaxCentre = true;
    run = [];
  };
  for (const group of groups) {
    if (group.nearClimax) {
      const previous = run[run.length - 1];
      if (previous && group.time - previous.time > CLIMAX_RUN_GAP_SECONDS) close();
      run.push(group);
    } else if (run.length) {
      close();
    }
  }
  if (run.length) close();
}

/**
 * Fit the grid under the cap while keeping the song's shape.
 *
 * Every analysed passage earns a share of the cap from its length, loudness
 * and vibe, after a coverage floor so quiet passages stay represented without
 * piling up. Within a passage the strongest beats are kept first (climaxes,
 * downbeats, half-bars) and, when a tier does not fit, its beats are spread
 * evenly rather than clustered. Choruses therefore keep meaningfully more of
 * their beats than verses, and an intro cannot consume the budget a later
 * chorus or finale needs. Groups stay atomic so a three-position accent is
 * never truncated.
 */
function capSlotGroups(params: {
  slots: CueSlot[];
  maxSlots: number;
  sections: AnalyserSection[];
  finalAnalysedBeatTime: number | null;
  beatsPerBar: number;
}): CueSlot[] {
  const { slots, maxSlots, sections, finalAnalysedBeatTime, beatsPerBar } = params;
  if (slots.length <= maxSlots) return slots;

  const slotsByTime = new Map<number, CueSlot[]>();
  for (const slot of slots) {
    const group = slotsByTime.get(slot.time);
    if (group) {
      group.push(slot);
    } else {
      slotsByTime.set(slot.time, [slot]);
    }
  }

  const halfBarPosition = beatsPerBar >= 4 ? Math.floor(beatsPerBar / 2) : null;
  const groups: SlotGroup[] = [...slotsByTime.entries()]
    .map(([time, groupSlots]) => {
      const sectionIndex = sections.findIndex(
        (section) => time >= section.start && time < section.end,
      );
      return {
        time,
        slots: groupSlots,
        sectionIndex,
        nearClimax: groupSlots.some((slot) => slot.nearClimax),
        peak: groupSlots.some((slot) => slot.emphasis === 'peak'),
        finale: groupSlots.some((slot) => slot.finale),
        downbeat: groupSlots.some((slot) => slot.isDownbeat),
        halfBar:
          halfBarPosition != null &&
          groupSlots.some((slot) => slot.barPosition === halfBarPosition),
        accent: groupSlots.some((slot) => slot.emphasis === 'accent'),
        intensity: Math.max(...groupSlots.map((slot) => slot.intensity)),
        climaxCentre: false,
      };
    })
    .sort((a, b) => a.time - b.time);
  markClimaxCentres(groups);

  const selectedTimes = new Set<number>();
  let selectedSlotCount = 0;
  const selectGroup = (group: SlotGroup, budget = maxSlots): boolean => {
    if (selectedTimes.has(group.time)) return true;
    if (selectedSlotCount + group.slots.length > budget) return false;
    selectedTimes.add(group.time);
    selectedSlotCount += group.slots.length;
    return true;
  };
  const selectedGroups = () => groups.filter((group) => selectedTimes.has(group.time));
  const distanceToSelected = (group: SlotGroup) =>
    Math.min(Infinity, ...selectedGroups().map((other) => Math.abs(other.time - group.time)));

  // Anchor the timeline at both ends. The final analysed beat is selected
  // explicitly because it represents the last musical hit rather than merely
  // another high-priority event inside a broad finale window.
  const firstGroup = groups[0];
  if (firstGroup) selectGroup(firstGroup);
  const finalAnalysedGroup =
    finalAnalysedBeatTime == null
      ? undefined
      : groups.find((group) => group.time === finalAnalysedBeatTime);
  const lastGroup = groups[groups.length - 1];
  if (finalAnalysedGroup) selectGroup(finalAnalysedGroup);
  else if (lastGroup) selectGroup(lastGroup);

  const buckets = buildSlotBuckets(groups, sections, maxSlots);

  // Within each passage keep whole tiers while they fit; spread a tier that
  // does not fit by always taking the beat farthest from anything selected,
  // so coverage stays even and the strongest beats keep their place.
  for (const bucket of buckets) {
    const used = () =>
      bucket.groups
        .filter((group) => selectedTimes.has(group.time))
        .reduce((total, group) => total + group.slots.length, 0);
    for (let tier = 0; tier < SLOT_TIERS; tier += 1) {
      const candidates = bucket.groups.filter(
        (group) => slotGroupTier(group) === tier && !selectedTimes.has(group.time),
      );
      const tierSize = candidates.reduce((total, group) => total + group.slots.length, 0);
      if (used() + tierSize <= bucket.budget) {
        for (const group of candidates) selectGroup(group);
        continue;
      }
      const pending = new Set(candidates);
      while (pending.size) {
        const remaining = bucket.budget - used();
        const fitting = [...pending].filter((group) => group.slots.length <= remaining);
        if (!fitting.length) break;
        const pick = fitting.sort(
          (a, b) =>
            distanceToSelected(b) - distanceToSelected(a) ||
            compareSlotGroupPriority(a, b) ||
            a.time - b.time,
        )[0];
        if (!pick || !selectGroup(pick)) break;
        pending.delete(pick);
      }
      break;
    }
  }

  // Close any gap the per-passage shares left open before spending the rest.
  let repaired = true;
  while (repaired && selectedSlotCount < maxSlots) {
    repaired = false;
    const selected = selectedGroups();
    for (let i = 1; i < selected.length; i++) {
      const left = selected[i - 1];
      const right = selected[i];
      if (!left || !right || right.time - left.time <= MAX_COVERAGE_GAP_SECONDS) continue;
      const midpoint = (left.time + right.time) / 2;
      const candidate = groups
        .filter(
          (group) =>
            group.time > left.time &&
            group.time < right.time &&
            !selectedTimes.has(group.time) &&
            selectedSlotCount + group.slots.length <= maxSlots,
        )
        .sort(
          (a, b) =>
            Math.abs(a.time - midpoint) - Math.abs(b.time - midpoint) ||
            compareSlotGroupPriority(a, b),
        )[0];
      if (candidate && selectGroup(candidate)) {
        repaired = true;
        break;
      }
    }
  }

  // Spend the remaining cap on the strongest musical events. Groups remain
  // atomic even when the final few slots cannot accommodate another group.
  for (const group of [...groups].sort(compareSlotGroupPriority)) {
    selectGroup(group);
  }

  return groups
    .filter((group) => selectedTimes.has(group.time))
    .sort((a, b) => a.time - b.time)
    .flatMap((group) => group.slots);
}

/**
 * Share the cap between analysed passages. Each passage first receives the
 * slots it needs for coverage; the remainder is divided by musical weight,
 * and a passage that cannot use its share passes the surplus on.
 */
function buildSlotBuckets(
  groups: SlotGroup[],
  sections: AnalyserSection[],
  maxSlots: number,
): SlotBucket[] {
  const bySection = new Map<number, SlotGroup[]>();
  for (const group of groups) {
    const list = bySection.get(group.sectionIndex);
    if (list) list.push(group);
    else bySection.set(group.sectionIndex, [group]);
  }
  const buckets: SlotBucket[] = [...bySection.entries()].map(([sectionIndex, bucketGroups]) => {
    const section = sections[sectionIndex];
    const start = section?.start ?? bucketGroups[0].time;
    const end = section?.end ?? bucketGroups[bucketGroups.length - 1].time;
    const span = Math.max(1, end - start);
    const vibe = vibeForSectionLabel(section?.label ?? '');
    const demand = bucketGroups.reduce((total, group) => total + group.slots.length, 0);
    const meanIntensity =
      bucketGroups.reduce((total, group) => total + group.intensity * group.slots.length, 0) /
      Math.max(1, demand);
    const vibeWeight =
      vibe === 'chorus' || vibe === 'drop'
        ? CHORUS_SLOT_WEIGHT
        : bucketGroups.some((group) => group.finale)
          ? FINALE_SLOT_WEIGHT
          : 1;
    // The floor reserves a typical group at every coverage step; gap repair
    // covers the odd wider group a coverage pick lands on.
    const sizes = bucketGroups.map((group) => group.slots.length).sort((a, b) => a - b);
    const typicalGroup = sizes[Math.floor(sizes.length / 2)] ?? 1;
    const floor = Math.min(demand, Math.ceil(span / COVERAGE_FLOOR_SECONDS) * typicalGroup);
    // Loudness counts steeply: a verse at half intensity earns a fraction of
    // a chorus's share, so the contrast the audience hears is one they see.
    const loudness = MIN_SLOT_WEIGHT + meanIntensity ** 3;
    return {
      start,
      end,
      groups: bucketGroups,
      weight: span * loudness * vibeWeight,
      demand,
      floor,
      budget: floor,
    };
  });

  // Water-fill the slots above the floors by weight until the cap is spent
  // or every passage is saturated. A small reserve stays back for gap repair.
  let spare =
    Math.floor(maxSlots * (1 - GAP_REPAIR_RESERVE_SHARE)) -
    buckets.reduce((total, bucket) => total + bucket.budget, 0);
  for (let round = 0; round < buckets.length + 1 && spare > 0.5; round += 1) {
    const open = buckets.filter((bucket) => bucket.budget < bucket.demand);
    if (!open.length) break;
    const totalWeight = open.reduce((total, bucket) => total + bucket.weight, 0);
    if (totalWeight <= 0) break;
    let granted = 0;
    for (const bucket of open) {
      const share = (spare * bucket.weight) / totalWeight;
      const grant = Math.min(bucket.demand - bucket.budget, share);
      bucket.budget += grant;
      granted += grant;
    }
    spare -= granted;
    if (granted <= 0) break;
  }
  for (const bucket of buckets) bucket.budget = Math.floor(bucket.budget);
  return buckets.sort((a, b) => a.start - b.start);
}

function clampBeatsPerBar(value: number): number {
  if (!Number.isFinite(value)) return 4;
  const v = Math.round(value);
  if (v === 2 || v === 3) return v;
  return 4;
}

function tubeCountForBeat(beat: { intensity: number; nearClimax: boolean; vibe: SlotVibe }) {
  if (beat.intensity >= 0.62 || beat.nearClimax || beat.vibe === 'chorus' || beat.vibe === 'drop') {
    return 3;
  }
  if (beat.intensity >= 0.4 || beat.vibe === 'pre-chorus' || beat.vibe === 'buildup') {
    return 2;
  }
  return 1;
}

function beatKey(beat: { time: number; sectionLabel: string; vibe: SlotVibe }): string {
  return `${beat.time}:${beat.sectionLabel}:${beat.vibe}`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampTempo(value: number): number {
  if (!Number.isFinite(value)) return 120;
  return Math.min(220, Math.max(50, value));
}
