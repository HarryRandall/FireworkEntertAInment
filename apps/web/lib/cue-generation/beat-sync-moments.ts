import type { CueSlot, SlotEmphasis, SlotVibe } from '../beat-grid.server';
import type { CreativeDirection } from './creative-direction';

export type BeatMoment = {
  time: number;
  sourceIndex: number;
  tubes: Array<0 | 1 | 2>;
  slotIndices: [number | null, number | null, number | null];
  intensity: number;
  sectionLabel: string;
  sectionKey: string;
  isSectionStart: boolean;
  vibe: SlotVibe;
  isDownbeat: boolean;
  nearClimax: boolean;
  finale: boolean;
  emphasis: SlotEmphasis;
  isSurprise: boolean;
};

export type FinalMusicalHit = {
  time: number;
  slotIndex: number;
  tube: 0 | 1 | 2;
};

/**
 * Return one canonical slot for the last musical impact. Prefer the centre
 * launch position when the beat grid exposes several simultaneous slots.
 */
export function findFinalMusicalHit(slots: CueSlot[]): FinalMusicalHit | null {
  if (!slots.length) return null;
  const finalTime = Math.max(...slots.map((slot) => slot.time));
  const finalSlot = slots
    .filter((slot) => Math.abs(slot.time - finalTime) <= 0.001)
    .sort(
      (left, right) =>
        Math.abs(left.tube - 1) - Math.abs(right.tube - 1) ||
        left.tube - right.tube ||
        left.index - right.index,
    )[0];
  if (!finalSlot) return null;
  return { time: finalTime, slotIndex: finalSlot.index, tube: finalSlot.tube };
}

export function launchPositionCountForSlots(slots: CueSlot[]): 1 | 2 | 3 {
  return Math.min(3, Math.max(1, ...slots.map((slot) => slot.tube + 1))) as 1 | 2 | 3;
}

export function buildBeatMoments(params: {
  slots: CueSlot[];
  songDuration: number;
  direction: CreativeDirection;
}): BeatMoment[] {
  const { slots, songDuration, direction } = params;
  const grouped = new Map<string, CueSlot[]>();

  for (const slot of slots) {
    const key = slot.time.toFixed(3);
    const group = grouped.get(key);
    if (group) group.push(slot);
    else grouped.set(key, [slot]);
  }

  const moments = Array.from(grouped.values())
    .map((group) => toMoment(group))
    .sort((a, b) => a.time - b.time);
  const finalMusicalHit = findFinalMusicalHit(slots);

  if (direction.surprise) {
    const finaleStart =
      moments.find((moment) => moment.finale)?.time ?? Math.max(8, songDuration - 18);
    const surprise = moments
      .filter(
        (moment) => moment.time >= Math.max(2, finaleStart - 14) && moment.time <= finaleStart - 2,
      )
      .sort((a, b) => Number(b.isDownbeat) - Number(a.isDownbeat) || b.time - a.time)[0];
    if (surprise) surprise.isSurprise = true;
  }

  const selected = moments.filter((moment) => {
    if (finalMusicalHit && Math.abs(moment.time - finalMusicalHit.time) <= 0.001) {
      return true;
    }
    const quietMiddle =
      direction.quietMiddle &&
      Math.abs(moment.time - songDuration * 0.5) <= Math.min(4, songDuration * 0.04);
    if (quietMiddle && !moment.nearClimax && !moment.isSurprise) return false;
    if (moment.nearClimax || moment.isSurprise) return true;
    if (direction.softEnding && moment.finale) return moment.isDownbeat;
    if (direction.density === 'sparse') return moment.isDownbeat;
    return true;
  });

  let sectionOccurrence = -1;
  let previousSection = '';
  for (const moment of selected) {
    const section = `${moment.sectionLabel}:${moment.vibe}`;
    if (section !== previousSection) {
      sectionOccurrence += 1;
      previousSection = section;
      moment.isSectionStart = true;
    }
    moment.sectionKey = `${sectionOccurrence}:${section}`;
  }

  return selected;
}

function toMoment(group: CueSlot[]): BeatMoment {
  const ordered = [...group].sort((a, b) => a.tube - b.tube || a.index - b.index);
  const representative = [...ordered].sort(
    (a, b) =>
      emphasisRank(b.emphasis) - emphasisRank(a.emphasis) ||
      b.intensity - a.intensity ||
      a.index - b.index,
  )[0];

  return {
    time: representative.time,
    sourceIndex: Math.min(...ordered.map((slot) => slot.index)),
    tubes: Array.from(new Set(ordered.map((slot) => slot.tube))),
    slotIndices: [0, 1, 2].map(
      (tube) => ordered.find((slot) => slot.tube === tube)?.index ?? null,
    ) as [number | null, number | null, number | null],
    intensity: Math.max(...ordered.map((slot) => slot.intensity)),
    sectionLabel: representative.sectionLabel,
    sectionKey: '',
    isSectionStart: false,
    vibe: representative.vibe,
    isDownbeat: ordered.some((slot) => slot.isDownbeat),
    nearClimax: ordered.some((slot) => slot.nearClimax),
    finale: ordered.some((slot) => slot.finale),
    emphasis: representative.emphasis,
    isSurprise: false,
  };
}

function emphasisRank(emphasis: SlotEmphasis): number {
  if (emphasis === 'peak') return 2;
  if (emphasis === 'accent') return 1;
  return 0;
}
