/**
 * Pure helpers for assembling the LLM prompt.
 *
 * Everything here is deterministic and side-effect free: it shapes the
 * payload we send to the model. Keep the prompt itself in one big string so
 * it's easy to diff and copy into prompt-engineering tools.
 */
import type { CueSlot } from '@/lib/beat-grid.server';
import type { listFireworkProducts } from '@/lib/shows.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';

/**
 * Top-level summary of the song analysis we hand the LLM. Falls back to a
 * synthetic 120 BPM grid description when no analyser run is available so
 * the model still gets some pacing context.
 */
export function buildAnalysisSummary(analysis: AnalyserResult | null, durationSeconds: number) {
  if (!analysis) {
    return {
      note: 'No AI song analysis was available; cues were timed against a synthetic 120 BPM grid.',
      durationSeconds,
    };
  }
  const beatTimes = analysis.beat_times ?? [];
  const sections = analysis.sections.map((section) => ({
    ...section,
    beatCount: beatTimes.filter((beat) => beat >= section.start && beat < section.end).length,
    targetFillRatio: targetFillRatioFor(section.intensity),
    densityHint: densityHintFor(section.label, section.intensity),
  }));

  return {
    durationSeconds: analysis.duration_seconds || durationSeconds,
    tempoBpm: analysis.tempo_bpm,
    musicProfile: analysis.music_profile,
    showPersonality: analysis.show_personality,
    sections,
    climaxes: analysis.key_moments?.filter((m) => m.type === 'climax'),
    buildups: analysis.buildups,
  };
}

function targetFillRatioFor(intensity: string): number {
  if (intensity === 'high') return 1;
  if (intensity === 'medium') return 0.8;
  return 0.55;
}

function densityHintFor(
  label: string,
  intensity: string,
): 'saturate' | 'ramp' | 'breathe' | 'tasteful' {
  const l = label.toLowerCase();
  if (l.includes('pre-chorus') || l.includes('build') || l.includes('rise')) return 'ramp';
  if (l.includes('chorus') || l.includes('drop') || l.includes('climax') || l.includes('finale')) {
    return 'saturate';
  }
  if (l.includes('intro') || intensity === 'low') return 'breathe';
  return 'tasteful';
}

/**
 * Project the firework catalogue down to the compact product shape the LLM
 * needs, including multi-shot metadata so it can choose sustained barrages.
 */
export function projectCatalogue(products: Awaited<ReturnType<typeof listFireworkProducts>>) {
  return products.map((product) => {
    const spec = product.spec ?? null;
    const shotCount = product.shotCount ?? 1;
    const description = compactText(product.description, 140);
    const effects = {
      ...(spec?.glitter && spec.glitter !== 'none' ? { glitter: spec.glitter } : {}),
      ...(spec?.trailEffect && spec.trailEffect !== 'none'
        ? { trailEffect: spec.trailEffect }
        : {}),
      ...(spec?.crackle ? { crackle: true } : {}),
      ...(spec?.strobe ? { strobe: true } : {}),
      ...(spec?.ring ? { ring: true } : {}),
      ...(spec?.crossette ? { crossette: true } : {}),
      ...(spec?.horsetail ? { horsetail: true } : {}),
      ...(spec?.floral ? { floral: true } : {}),
      ...(spec?.fallingLeaves ? { fallingLeaves: true } : {}),
    };
    return {
      id: product.id,
      name: product.name,
      ...(description ? { description } : {}),
      ...(product.durationSeconds != null ? { durationSeconds: product.durationSeconds } : {}),
      shotCount,
      isMultiShot: shotCount > 1,
      ...(product.heightMeters != null ? { heightMeters: product.heightMeters } : {}),
      ...(product.caliber ? { caliber: product.caliber } : {}),
      ...(spec?.shellType ? { shellType: spec.shellType } : {}),
      ...(spec?.color ? { color: spec.color } : {}),
      ...(spec?.colorPalette?.length ? { colorPalette: spec.colorPalette } : {}),
      ...(Object.keys(effects).length ? { effects } : {}),
    };
  });
}

function compactText(value: string | null | undefined, maxLength: number): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

/**
 * Compact slot projection (~12 chars per slot) so we don't blow the token
 * budget on a long song with hundreds of beats.
 */
export function projectSlotsForLLM(slots: CueSlot[]) {
  return slots.map((s) => ({
    i: s.index,
    t: s.time,
    tube: s.tube,
    v: s.vibe,
    e: Number(s.intensity.toFixed(2)),
    climax: s.nearClimax ? 1 : 0,
    section: s.sectionLabel,
  }));
}

/**
 * The full system prompt. This is the biggest quality lever we have, so
 * keep edits intentional and review prompt diffs carefully — small wording
 * changes have outsized effects on pacing and product variety.
 */
export function buildSystemPrompt(): string {
  return [
    'You are a senior pyrotechnic show designer choreographing an exciting, beat-synced fireworks show.',
    "The user has written a 'userPrompt' describing the show they want — treat it as the single most important creative direction. Honour it over every other heuristic.",
    '',
    'Inputs you receive:',
    "  - userPrompt: the user's verbatim creative brief. Always re-read it before assigning cues.",
    '  - brief: title, mood tags, budget, time of day, location, requested duration.',
    '  - analysisSummary: song structure — duration, tempo, sections (start/end/label/energy/beatCount/targetFillRatio/densityHint), climaxes, buildups, music_profile, show_personality.',
    '  - catalogue: every available product with id, name, compact description, durationSeconds, shotCount, isMultiShot, caliber, heightMeters, shellType, color, colorPalette, and any active effect flags.',
    '  - slots: a dense beat grid sampled from the actual analysed beats. Each slot is { i (index), t (seconds), tube (0|1|2), v (vibe), e (intensity 0-1), climax, section }. Slots are the ONLY times you can fire on.',
    '',
    'Output: assign at most one product per slot. Return { cues: [{ slotIndex, productId, description }], rationale }.',
    '',
    'Hard rules:',
    '  - slotIndex MUST exist in the slots array. Never invent indices.',
    '  - productId MUST be a catalogue id. Never invent ids.',
    '  - You do NOT choose the time or tube — they come from the slot you pick.',
    '  - One cue per slotIndex, no duplicates.',
    '',
    'Pacing rules (this is the biggest quality lever — get it right):',
    "  - The show must FEEL like the song. Cue density and product size should track each slot's intensity e and section densityHint.",
    '  - Target overall fill: 90–100% of slots. Never fall below 85% in chorus, drop, climax, or finale sections.',
    '  - Intro / first verse: breathe, but do not go mute. Aim for about 50% fill with single-tube, small-caliber, mostly single-shot pops on downbeats.',
    '  - Buildups / pre-chorus: ramp from about 60% fill at the start to 100% in the last second before the climax. Stack effects to communicate rising tension.',
    '  - Chorus / drop / climax: saturate. Every slot fires. Use multi-shot cakes on at least one tube to lay a continuous bed, and put single-shot pops on the other tubes on every beat.',
    '  - Post-chorus verses: keep the energy alive at about 65–75% fill so the show does not crater after a hook.',
    '  - Outro / finale: every tube, every slot, finishers plus multi-shot cakes if the song ends loud; taper only when the ending is clearly soft.',
    '',
    'Product timing rules:',
    '  - Single-shot products = pops on the beat. Use these to hit beats, climaxes, and accent moments.',
    '  - Multi-shot products = sustained barrages. Place them at section boundaries: start of chorus, peak of buildup, and start of finale.',
    "  - Multi-shots block their tube for the product's full airtime, so plan the other two tubes around them instead of trying to reuse that tube immediately.",
    '',
    'Variety rules:',
    '  - Rotate effects aggressively in chorus/drop sections: crackle, strobe, ring, crossette, willow, glitter, color changes.',
    '  - Two adjacent beats in a chorus/drop should not use the same product.',
    '  - Within any 8-second window during chorus/drop, use at least 4 distinct products when the catalogue allows.',
    '  - Across the whole show, use at least 60% of the catalogue at least once when catalogue size allows.',
    '',
    'Creative direction:',
    "  - The userPrompt overrides defaults. If they say 'mostly green', favour green; if they say 'patriotic', red/white/blue with gold finishers; if they say 'minimalist', drop the fill ratio toward 65%.",
    "  - Match each cue's product to its slot vibe AND to the userPrompt palette.",
    "  - description: ≤ 180 chars, one sentence, says WHAT fires and WHY this beat (e.g. 'Twin gold willows on the snare hit before the drop').",
    '  - rationale: 1–2 sentences explaining chorus saturation, multi-shot placement, and how the structure serves the userPrompt.',
    '',
    'Output schema (return EXACTLY this JSON shape, no prose, no markdown fences):',
    '  { "cues": [{ "slotIndex": <int>, "productId": "<uuid>", "description": "<string ≤180 chars>" }, ...], "rationale": "<string>" }',
    'Constraints: cues.length 1–360. Every slotIndex must exist in slots. Every productId must exist in catalogue. No duplicate slotIndex. Return ONLY the JSON object, nothing else.',
  ].join('\n');
}
