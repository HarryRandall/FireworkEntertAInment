/**
 * Pure helpers for assembling the LLM prompt.
 *
 * Everything here is deterministic and side-effect free: it shapes the
 * payload we send to the model. Keep the prompt itself in one big string so
 * it's easy to diff and copy into prompt-engineering tools.
 */
import type { CueSlot } from '@/lib/beat-grid.server';
import { asProductCatalogueFields, type ProductCatalogueField } from '@/lib/prompt-configs';
import type { listFireworkProducts } from '@/lib/shows.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { SHOW_STYLES, type ShowStyleKey } from './show-styles';

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
    beatGrid: describeBeatGrid(beatTimes, analysis.tempo_bpm),
    musicProfile: analysis.music_profile,
    showPersonality: analysis.show_personality,
    sections,
    climaxes: analysis.key_moments?.filter((m) => m.type === 'climax'),
    buildups: analysis.buildups,
  };
}

/**
 * Compact beat-grid description so the model knows slot times ARE the
 * analysed beats and how tightly spaced they are.
 */
function describeBeatGrid(beatTimes: number[], tempoBpm: number | null | undefined) {
  if (!beatTimes.length) {
    return {
      source: 'synthetic' as const,
      note: 'Slot times come from a synthetic tempo grid; firing on a slot still lands on the implied beat.',
    };
  }
  const intervals: number[] = [];
  for (let i = 1; i < beatTimes.length; i += 1) {
    intervals.push(beatTimes[i] - beatTimes[i - 1]);
  }
  intervals.sort((a, b) => a - b);
  const median = intervals.length ? intervals[Math.floor(intervals.length / 2)] : null;
  return {
    source: 'analysed' as const,
    beatCount: beatTimes.length,
    medianBeatIntervalSeconds: median != null ? Number(median.toFixed(3)) : null,
    tempoBpm: tempoBpm ?? null,
    note: 'Every slot time t is an exact analysed beat timestamp. Assigning a cue to a slot fires it exactly on that beat.',
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
export function projectCatalogue(
  products: Awaited<ReturnType<typeof listFireworkProducts>>,
  selectedFields?: readonly ProductCatalogueField[] | null,
) {
  const fields = new Set(asProductCatalogueFields(selectedFields));
  const include = (field: ProductCatalogueField) => fields.has(field);

  return products.map((product) => {
    const spec = product.spec ?? null;
    const shotCount = product.shotCount ?? 1;
    const description = include('description') ? compactText(product.description, 140) : null;
    const effects = include('effects')
      ? {
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
        }
      : {};
    return {
      id: product.id,
      ...(include('name') ? { name: product.name } : {}),
      ...(description ? { description } : {}),
      ...(include('durationSeconds') && product.durationSeconds != null
        ? { durationSeconds: product.durationSeconds }
        : {}),
      ...(include('shotCount') ? { shotCount } : {}),
      ...(include('isMultiShot') ? { isMultiShot: shotCount > 1 } : {}),
      ...(include('heightMeters') && product.heightMeters != null
        ? { heightMeters: product.heightMeters }
        : {}),
      ...(include('caliber') && product.caliber ? { caliber: product.caliber } : {}),
      ...(include('shellType') && spec?.shellType ? { shellType: spec.shellType } : {}),
      ...(include('color') && spec?.color ? { color: spec.color } : {}),
      ...(include('colorPalette') && spec?.colorPalette?.length
        ? { colorPalette: spec.colorPalette }
        : {}),
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
 * The default full system prompt. This is the biggest quality lever we have,
 * so keep edits intentional and review prompt diffs carefully.
 */
export const DEFAULT_SHOW_CUE_SYSTEM_PROMPT = [
  'You are a senior pyrotechnic show designer choreographing an exciting, beat-synced fireworks show.',
  "The user has written a 'userPrompt' describing the show they want - treat it as the single most important creative direction. Honour it over every other heuristic.",
  '',
  'Inputs you receive:',
  "  - userPrompt: the user's verbatim creative brief. Always re-read it before assigning cues.",
  '  - brief: title, mood tags, budget, time of day, location, requested duration, siteWidthFeet, launchPositions, and optionally fireworkTypes.',
  '  - brief.launchPositions is how many firing positions the site supports; the slots already respect it, so never assume more tubes exist.',
  '  - brief.fireworkTypes, when present, lists the only product families the user wants. The catalogue is already filtered to match where possible - stay inside it.',
  '  - analysisSummary: song structure: duration, tempo, beatGrid, sections (start/end/label/energy/beatCount/targetFillRatio/densityHint), climaxes, buildups, music_profile, show_personality.',
  '  - catalogue: every available product with id, name, compact description, durationSeconds, shotCount, isMultiShot, caliber, heightMeters, shellType, color, colorPalette, and any active effect flags.',
  '  - slots: a dense beat grid sampled from the actual analysed beats. Each slot is { i (index), t (seconds), tube (0|1|2), v (vibe), e (intensity 0-1), climax, section }. Slots are the ONLY times you can fire on.',
  '',
  'Output: assign at most one product per slot. Return { cues: [{ slotIndex, productId, description }], rationale }.',
  '',
  'Hard rules:',
  '  - slotIndex MUST exist in the slots array. Never invent indices.',
  '  - productId MUST be a catalogue id. Never invent ids.',
  '  - You do NOT choose the time or tube - they come from the slot you pick.',
  '  - One cue per slotIndex, no duplicates.',
  '',
  'Beat synchronisation (non-negotiable):',
  '  - Every slot time t is an exact analysed beat timestamp. A cue on a slot fires exactly on that beat; there is no other way to be on-beat.',
  '  - Never leave a climax slot empty. Climax beats are the moments the audience remembers.',
  '  - Treat consecutive slots that share the same t as one beat across multiple tubes: stack them for emphasis on strong beats.',
  '  - When in doubt between two slots, pick the one whose section and intensity better match the product size - never shift a big product onto a weak beat.',
  '',
  'Pacing rules (this is the biggest quality lever - get it right):',
  "  - The show must FEEL like the song. Cue density and product size should track each slot's intensity e and section densityHint.",
  '  - Target overall fill: 90-100% of slots. Never fall below 85% in chorus, drop, climax, or finale sections.',
  '  - Intro / first verse: breathe, but do not go mute. Aim for about 50% fill with single-tube, small-caliber, mostly single-shot pops on downbeats.',
  '  - Buildups / pre-chorus: ramp from about 60% fill at the start to 100% in the last second before the climax. Stack effects to communicate rising tension.',
  '  - Chorus / drop / climax: saturate. Every slot fires. Use multi-shot cakes on at least one tube to lay a continuous bed, and put single-shot pops on the other tubes on every beat.',
  '  - Post-chorus verses: keep the energy alive at about 65-75% fill so the show does not crater after a hook.',
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

export const DEFAULT_SHOW_CUE_PRODUCT_CONTEXT_TEXT = [
  'Product context instructions:',
  '  - Treat the catalogue JSON as the complete list of products available for this show.',
  '  - Use catalogue ids exactly as supplied. Never invent product ids, names, or substitute products that are not present.',
  '  - Prefer products whose colours, effect flags, shot count, duration, height, calibre, and description fit the slot vibe and the userPrompt.',
  '  - Multi-shot products are useful for sustained musical sections, but they occupy their launch tube for their full durationSeconds.',
  '  - Single-shot products are best for beat hits, accents, transitions, and precise climax moments.',
].join('\n');

/**
 * Build the final system prompt sent to OpenRouter. With no arguments this
 * returns the historical default prompt so tests and fallback behaviour remain
 * stable.
 */
export function buildSystemPrompt(
  options: {
    systemPromptText?: string | null;
    productContextText?: string | null;
    productCatalogueFields?: readonly ProductCatalogueField[] | null;
    /** Show style picked in the wizard; layers style directives on the base prompt. */
    showStyle?: ShowStyleKey | null;
  } = {},
): string {
  const systemPrompt = options.systemPromptText?.trim() || DEFAULT_SHOW_CUE_SYSTEM_PROMPT;
  const styleDirectives = options.showStyle
    ? (SHOW_STYLES[options.showStyle]?.promptDirectives ?? null)
    : null;
  const productContext = options.productContextText?.trim();
  const productFields = asProductCatalogueFields(options.productCatalogueFields);
  const fieldContext = `Catalogue fields sent in this request: ${productFields.join(', ')}. Do not assume omitted catalogue fields are available.`;

  return [systemPrompt, styleDirectives, productContext, fieldContext].filter(Boolean).join('\n\n');
}
