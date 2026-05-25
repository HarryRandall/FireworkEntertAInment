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
  return {
    durationSeconds: analysis.duration_seconds || durationSeconds,
    tempoBpm: analysis.tempo_bpm,
    musicProfile: analysis.music_profile,
    showPersonality: analysis.show_personality,
    sections: analysis.sections,
    climaxes: analysis.key_moments?.filter((m) => m.type === 'climax'),
    buildups: analysis.buildups,
  };
}

/**
 * Project the firework catalogue down to single-shot products (multi-shot
 * cakes occupy a tube for many seconds and can't be safely placed by the
 * generator yet) and flatten effect flags for the LLM to consume.
 */
export function projectCatalogue(products: Awaited<ReturnType<typeof listFireworkProducts>>) {
  const singleShot = products.filter((p) => p.shotCount === 1);
  return singleShot.map((product) => {
    const spec = product.spec ?? null;
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      durationSeconds: product.durationSeconds,
      heightMeters: product.heightMeters,
      caliber: product.caliber,
      shellType: spec?.shellType ?? null,
      color: spec?.color ?? null,
      colorPalette: spec?.colorPalette ?? null,
      effects: {
        glitter: spec?.glitter ?? null,
        trailEffect: spec?.trailEffect ?? null,
        crackle: spec?.crackle ?? false,
        strobe: spec?.strobe ?? false,
        ring: spec?.ring ?? false,
        crossette: spec?.crossette ?? false,
        horsetail: spec?.horsetail ?? false,
      },
    };
  });
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
    'You are a senior pyrotechnic show designer choreographing a song with single-shot fireworks.',
    "The user has written a 'userPrompt' describing the show they want — treat it as the single most important creative direction. Honour it over every other heuristic.",
    '',
    'Inputs you receive:',
    "  - userPrompt: the user's verbatim creative brief. Always re-read it before assigning cues.",
    '  - brief: title, mood tags, budget, time of day, location, requested duration.',
    '  - analysisSummary: full song structure — duration, tempo, sections (start/end/label/energy), climaxes, buildups, music_profile, show_personality.',
    "  - beatGrid: every analysed beat with { t (sec), section, vibe, intensity, climax }. This is your high-resolution timing reference — use it to feel the song's pacing.",
    '  - catalogue: every available SINGLE-SHOT product with id, name, description, durationSeconds, caliber, heightMeters, shellType, color, colorPalette, and effect flags (glitter, trailEffect, crackle, strobe, ring, crossette, horsetail).',
    '  - slots: a dense beat grid sampled from the actual analysed beats. Each slot is { i (index), t (seconds), tube (0|1|2), v (vibe), e (intensity 0-1), climax, section }. Slots are the ONLY times you can fire on. Their intensity e and vibe v are your high-resolution pacing reference — use them to feel the song.',
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
    "  - The show must FEEL like the song. Cue density and product size should track each slot's intensity e, not just be uniformly dense.",
    '  - First 10–15% of the song (intro / first verse): VERY sparse. Maybe one cue every 4–8 seconds. Small caliber, single colour, elegant. This is the breath before the build.',
    '  - Buildups: ramp deliberately. Earlier buildup beats should still feel restrained; only the final 2–3 seconds before a climax should hit full intensity. The audience should feel tension rising.',
    '  - Choruses / drops / climaxes: dense, fast, biggest catalogue items. Stack multiple tubes on the same beat where slots allow. Use crackle/strobe/multi-colour combos here.',
    "  - Verses after a chorus: pull back to ~50% density. Don't keep the climax energy flat across the whole song or the finale loses meaning.",
    "  - Outro / finale: either a big sustained finale wall (if the song ends loud) or a graceful tapering set of single shells (if it ends soft). Match the song's actual ending energy from the slot intensities.",
    '  - Target overall fill: 70–90% of slots. A masterful show LEAVES SPACE — better to skip a slot than to spam.',
    '',
    'Creative direction:',
    "  - The userPrompt overrides defaults. If they say 'mostly green', favour green; if they say 'patriotic', red/white/blue with gold finishers; if they say 'minimalist', drop the fill ratio toward 65%.",
    "  - Match each cue's product to its slot vibe AND to the userPrompt palette.",
    "  - Rotate through the catalogue — don't repeat the same product back-to-back unless it's a deliberate motif (e.g. matching the chorus hook).",
    "  - description: ≤ 180 chars, one sentence, says WHAT fires and WHY this beat (e.g. 'Twin gold willows on the snare hit before the drop').",
    '  - rationale: 2–4 sentences explaining the overall structure you chose and how it serves the userPrompt.',
    '',
    'Output schema (return EXACTLY this JSON shape, no prose, no markdown fences):',
    '  { "cues": [{ "slotIndex": <int>, "productId": "<uuid>", "description": "<string ≤180 chars>" }, ...], "rationale": "<string>" }',
    'Constraints: cues.length 1–240. Every slotIndex must exist in slots. Every productId must exist in catalogue. No duplicate slotIndex. Return ONLY the JSON object, nothing else.',
  ].join('\n');
}
