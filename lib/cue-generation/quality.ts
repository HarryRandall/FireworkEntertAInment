import type { CueSlot } from '@/lib/beat-grid.server';
import type { PromptConstraintViolation } from './prompt-constraints';

type QualityCue = {
  impactTimeSeconds: number;
  productId: string;
  slotIndex: number;
  tube: 0 | 1 | 2;
};

export type ChoreographyIssue =
  | { kind: 'missing_section'; detail: string; hard: false }
  | { kind: 'long_gap'; detail: string; hard: false }
  | { kind: 'weak_strong_moments'; detail: string; hard: false }
  | { kind: 'unused_launch_position'; detail: string; hard: false }
  | { kind: 'missing_final_hit'; detail: string; hard: true }
  | { kind: 'prompt_constraint'; detail: string; hard: true };

export type ChoreographyScore = {
  issues: ChoreographyIssue[];
  maximumGapSeconds: number;
  sectionCoverageRatio: number;
  coordinatedStrongMomentRatio: number;
};

/**
 * Score the final, safety-filtered cue set rather than trusting planner intent.
 * This is the boundary that catches a model response or greedy safety pass
 * which looked viable before important grouped moments were removed.
 */
export function evaluateFinalChoreography(params: {
  cues: QualityCue[];
  slots: CueSlot[];
  promptViolations: PromptConstraintViolation[];
  maxTubes: 1 | 2 | 3;
  sparse: boolean;
}): ChoreographyScore {
  const { cues, slots, promptViolations, maxTubes, sparse } = params;
  const issues: ChoreographyIssue[] = [];
  const acceptedSlotIndices = new Set(cues.map((cue) => cue.slotIndex));
  const orderedSlots = [...slots].sort((a, b) => a.time - b.time || a.index - b.index);
  const sections = sectionOccurrences(orderedSlots);
  const coveredSections = sections.filter((section) =>
    section.slotIndices.some((index) => acceptedSlotIndices.has(index)),
  );
  const sectionCoverageRatio = sections.length ? coveredSections.length / sections.length : 1;
  for (const section of sections) {
    if (!section.slotIndices.some((index) => acceptedSlotIndices.has(index))) {
      issues.push({ kind: 'missing_section', detail: section.label, hard: false });
    }
  }

  const impacts = Array.from(
    new Set(cues.map((cue) => Number(cue.impactTimeSeconds.toFixed(3)))),
  ).sort((a, b) => a - b);
  let maximumGapSeconds = 0;
  for (let index = 1; index < impacts.length; index += 1) {
    maximumGapSeconds = Math.max(maximumGapSeconds, impacts[index] - impacts[index - 1]);
  }
  const allowedGap = sparse ? 12 : 8;
  if (maximumGapSeconds > allowedGap) {
    issues.push({
      kind: 'long_gap',
      detail: `${maximumGapSeconds.toFixed(2)}s exceeds ${allowedGap}s`,
      hard: false,
    });
  }

  const slotsByTime = groupSlotsByTime(orderedSlots);
  const strongGroups = slotsByTime.filter((group) =>
    group.slots.some(
      (slot) =>
        slot.nearClimax ||
        slot.emphasis === 'peak' ||
        slot.vibe === 'chorus' ||
        slot.vibe === 'drop' ||
        (slot.finale && slot.isDownbeat),
    ),
  );
  const desiredStrongTubeCount = Math.min(2, maxTubes);
  const coordinatedStrongGroups = strongGroups.filter((group) => {
    const acceptedTubes = new Set(
      group.slots.filter((slot) => acceptedSlotIndices.has(slot.index)).map((slot) => slot.tube),
    );
    return acceptedTubes.size >= desiredStrongTubeCount;
  });
  const coordinatedStrongMomentRatio = strongGroups.length
    ? coordinatedStrongGroups.length / strongGroups.length
    : 1;
  const minimumStrongRatio = sparse ? 0.35 : 0.6;
  if (coordinatedStrongMomentRatio < minimumStrongRatio) {
    issues.push({
      kind: 'weak_strong_moments',
      detail: `${Math.round(coordinatedStrongMomentRatio * 100)}% coordinated`,
      hard: false,
    });
  }

  const usedTubes = new Set(cues.map((cue) => cue.tube));
  if (maxTubes > 1 && usedTubes.size < maxTubes) {
    issues.push({
      kind: 'unused_launch_position',
      detail: `${usedTubes.size} of ${maxTubes} positions used`,
      hard: false,
    });
  }

  const finalMusicalHit = orderedSlots.at(-1)?.time;
  if (
    finalMusicalHit != null &&
    !cues.some((cue) => Math.abs(cue.impactTimeSeconds - finalMusicalHit) <= 0.011)
  ) {
    issues.push({
      kind: 'missing_final_hit',
      detail: `No visible impact at ${finalMusicalHit.toFixed(3)}s`,
      hard: true,
    });
  }

  for (const violation of promptViolations) {
    issues.push({
      kind: 'prompt_constraint',
      detail: describePromptViolation(violation),
      hard: true,
    });
  }

  return {
    issues,
    maximumGapSeconds: Number(maximumGapSeconds.toFixed(3)),
    sectionCoverageRatio: Number(sectionCoverageRatio.toFixed(3)),
    coordinatedStrongMomentRatio: Number(coordinatedStrongMomentRatio.toFixed(3)),
  };
}

function sectionOccurrences(slots: CueSlot[]): Array<{ label: string; slotIndices: number[] }> {
  const occurrences: Array<{ label: string; slotIndices: number[] }> = [];
  let previousKey = '';
  for (const slot of slots) {
    const key = `${slot.sectionLabel}:${slot.vibe}`;
    if (key !== previousKey) {
      occurrences.push({ label: `${occurrences.length + 1}:${key}`, slotIndices: [] });
      previousKey = key;
    }
    occurrences.at(-1)?.slotIndices.push(slot.index);
  }
  return occurrences;
}

function groupSlotsByTime(slots: CueSlot[]): Array<{ time: number; slots: CueSlot[] }> {
  const groups = new Map<number, CueSlot[]>();
  for (const slot of slots) {
    const group = groups.get(slot.time);
    if (group) group.push(slot);
    else groups.set(slot.time, [slot]);
  }
  return Array.from(groups, ([time, groupedSlots]) => ({ time, slots: groupedSlots }));
}

function describePromptViolation(violation: PromptConstraintViolation): string {
  return `${violation.kind.replaceAll('_', ' ')}: ${violation.value}`;
}
