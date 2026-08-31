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
  const downbeatTimes = analysis.downbeat_times ?? [];
  const beatsPerBar = analysis.beats_per_bar ?? 4;
  const sections = analysis.sections.map((section) => ({
    ...section,
    beatCount: beatTimes.filter((beat) => beat >= section.start && beat < section.end).length,
    targetFillRatio: targetFillRatioFor(section.intensity),
    densityHint: densityHintFor(section.label, section.intensity),
  }));

  return {
    durationSeconds: analysis.duration_seconds || durationSeconds,
    tempoBpm: analysis.tempo_bpm,
    beatGrid: describeBeatGrid(beatTimes, analysis.tempo_bpm, beatsPerBar, downbeatTimes.length),
    downbeats: downbeatTimes,
    beatsPerBar,
    derived: analysis.derived ?? null,
    energyTimeline: downsampleEnergy(analysis.energy_timeline ?? []),
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
function describeBeatGrid(
  beatTimes: number[],
  tempoBpm: number | null | undefined,
  beatsPerBar: number,
  downbeatCount: number,
) {
  if (!beatTimes.length) {
    return {
      source: 'synthetic' as const,
      note: 'Slot times are musical anchors on a synthetic tempo grid. Direct single shots burst on the anchor; multishot sequences start there.',
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
    beatsPerBar,
    downbeatCount,
    medianBeatIntervalSeconds: median != null ? Number(median.toFixed(3)) : null,
    tempoBpm: tempoBpm ?? null,
    note: 'Every slot time t is an exact analysed beat (or a strong onset accent). Direct single shots burst at t; multishot sequences start at t.',
  };
}

/**
 * Coarsen the per-second energy timeline to roughly one sample per 2.5s
 * (keeping the peak in each window) so the model sees the energy curve
 * without blowing the token budget.
 */
function downsampleEnergy(
  timeline: { time: number; energy: number }[],
): { time: number; energy: number }[] {
  if (timeline.length <= 1) return timeline;
  const windowSec = 2.5;
  const out: { time: number; energy: number }[] = [];
  let i = 0;
  const last = timeline[timeline.length - 1].time;
  for (let start = 0; start <= last + 1e-6; start += windowSec) {
    let max = -1;
    let maxT = start;
    while (i < timeline.length && timeline[i].time < start + windowSec) {
      if (timeline[i].energy > max) {
        max = timeline[i].energy;
        maxT = timeline[i].time;
      }
      i += 1;
    }
    if (max >= 0) out.push({ time: Number(maxT.toFixed(1)), energy: Number(max.toFixed(2)) });
  }
  return out;
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
      ...(product.launchPositionOverrideIndices?.length
        ? { launchPositionOverrideIndices: product.launchPositionOverrideIndices }
        : {}),
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
    db: s.isDownbeat ? 1 : 0,
    bar: s.barPosition,
    em: s.emphasis === 'peak' ? 2 : s.emphasis === 'accent' ? 1 : 0,
    fin: s.finale ? 1 : 0,
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
  '  - brief: title, mood tags, a soft budget preference, time of day, location, requested duration, siteWidthFeet, launchPositions, and optionally fireworkTypes. Never sacrifice safe musical coverage merely to reduce spend.',
  '  - brief.launchPositions is how many firing positions the site supports; the slots already respect it, so never assume more tubes exist.',
  '  - brief.fireworkTypes, when present, lists the only product families the user wants. The catalogue is already filtered to match where possible - stay inside it.',
  '  - analysisSummary: song structure: duration, tempo, beatGrid (beatCount, beatsPerBar, downbeatCount), downbeats, sections (start/end/label/energy/beatCount/targetFillRatio/densityHint), climaxes, buildups, derived (finale_window, anchor_windows, repeated_chorus_count, section_rank_by_energy), energyTimeline, music_profile, show_personality.',
  '  - catalogue: every available product with id, name, compact description, durationSeconds, shotCount, isMultiShot, optional launchPositionOverrideIndices, caliber, heightMeters, shellType, color, colorPalette, and any active effect flags.',
  '  - slots: musical anchors sampled from the analysed beats (plus a few strong onset accents). Each slot is { i (index), t (target seconds), tube (0|1|2), v (vibe), e (intensity 0-1), db (1=downbeat/bar-1), bar (beat-in-bar, 0=downbeat, -1=onset accent), em (emphasis 0=normal,1=accent,2=peak), fin (1=inside finale window), climax, section }. For a direct single shot, t is its visible burst. For a multishot, t is the start of its sustained sequence.',
  '',
  'Output: assign at most one product per slot. Return { cues: [{ slotIndex, productId, emphasis? }], rationale }.',
  '',
  'Hard rules:',
  '  - slotIndex MUST exist in the slots array. Never invent indices.',
  '  - productId MUST be a catalogue id. Never invent ids.',
  '  - You do NOT choose the musical time or tube - they come from the slot you pick. For direct single shots, the server calculates the earlier renderer launch after you choose the product and emphasis.',
  '  - One cue per slotIndex, no duplicates.',
  '',
  'Beat synchronisation (non-negotiable):',
  '  - Every slot time t is an exact analysed beat (or a strong onset accent with bar=-1). Use direct single shots for precise beat hits; the server subtracts their renderer-matched lift time so the burst lands at t.',
  '  - Fire on the bar. db:1 slots are bar downbeats - the strongest musical grid lines. In verses, intro and bridge, fill downbeats first and leave most off-beats empty.',
  '  - Saturate chorus and drop at every physically safe moment, with the biggest products on db:1 downbeats. Never request an overlap merely to fill a slot.',
  '  - Never leave a climax (climax:1) or em:2 slot empty. These are the moments the audience remembers.',
  '  - Treat consecutive slots that share the same t as one beat across multiple tubes: stack them for emphasis on strong beats.',
  '  - When in doubt between two slots, pick the one whose section, downbeat and intensity better match the product size - never shift a big product onto a weak off-beat.',
  '',
  'Emphasis and finale (this makes climaxes visibly bigger):',
  '  - em tiers: 2=peak, 1=accent, 0=normal. Each slot already carries a suggested em; you may override it by returning emphasis on a cue when you have a creative reason, otherwise leave it out and the slot value is used.',
  '  - Put your largest-calibre, highest, multi-shot products on em:2 slots. Medium products on em:1. Small single-shot pops on em:0.',
  '  - fin:1 slots are inside the finale window. Hold back your 2-3 biggest products for the finale and stack every free tube on its structural accents; taper only if the song ends soft.',
  '  - Ramp buildups beat-over-beat: increasing product size and density as bar numbers rise into a drop or chorus.',
  '',
  'Pacing rules (this is the biggest quality lever - get it right):',
  "  - The show must FEEL like the song. Cue density and product size should track each slot's intensity e, emphasis em and section densityHint.",
  '  - Follow the request targets for overall and chorus fill. Normal high-energy styles aim for 75-95% overall; minimalist aims for 50-68%. Never leave a climax or em:2 slot empty.',
  '  - Intro / first verse: breathe, but do not go mute. Aim for about 50% fill with single-tube, small-calibre, mostly single-shot pops on downbeats (db:1).',
  '  - Buildups / pre-chorus: ramp from about 60% fill at the start to 100% in the last second before the drop/chorus. Stack effects to communicate rising tension.',
  '  - Chorus / drop / climax: saturate every safe musical moment. Start a multi-shot bed on a free tube at the section boundary, then stack direct single-shot accents across the other free tubes on downbeats and peaks.',
  '  - Post-chorus verses: keep the energy alive at about 65-75% fill so the show does not crater after a hook.',
  '  - Outro / finale: stack every free tube at safe downbeats and peaks, with finishers plus multi-shot beds when the song ends loud; taper only when the ending is clearly soft.',
  '',
  'Product timing rules:',
  '  - Single-shot products = precise burst impacts. Use these to hit beats, climaxes, and accent moments; their launch is automatically moved earlier by the exact scaled lift time.',
  '  - Multi-shot products = sustained barrages. Their parent sequence starts at t, while child shots retain their stored offsets and angles. Place them at section boundaries: start of chorus, peak of buildup, start of drop, and start of the finale window.',
  "  - Multi-shots block the parent tube and every absolute child tube in launchPositionOverrideIndices for the product's full airtime. Plan the remaining positions around them.",
  '',
  'Variety rules:',
  '  - Rotate effects aggressively in chorus/drop sections: crackle, strobe, ring, crossette, willow, glitter, colour changes.',
  '  - Two adjacent beats in a chorus/drop should not use the same product.',
  '  - Across each chorus/drop, use at least 3 distinct products when the catalogue and occupied firing windows allow.',
  '  - Across the whole show, use at least 60% of the catalogue at least once when catalogue size allows.',
  '',
  'Creative direction:',
  "  - The userPrompt overrides defaults. If they say 'mostly green', favour green; if they say 'patriotic', red/white/blue with gold finishers; if they say 'minimalist', drop the fill ratio toward 65%.",
  "  - Match each cue's product to its slot vibe AND to the userPrompt palette.",
  '  - rationale: 1-2 sentences explaining bar-downbeat placement, chorus/drop saturation, finale hold-back, and how the structure serves the userPrompt.',
  '',
  'Output schema (return EXACTLY this JSON shape, no prose, no markdown fences):',
  '  { "cues": [{ "slotIndex": <int>, "productId": "<uuid>", "emphasis": "normal"|"accent"|"peak" (optional) }, ...], "rationale": "<string>" }',
  'Constraints: cues.length 1-360. Every slotIndex must exist in slots. Every productId must exist in catalogue. No duplicate slotIndex. Return ONLY the JSON object, nothing else.',
].join('\n');

const SHOW_CUE_RUNTIME_GUARDRAILS = [
  'Runtime choreography contract:',
  '  - Catalogue duration and occupied launch positions are hard safety constraints. Never trade them for an impossible fill target.',
  '  - Treat the budget as a soft preference. Prioritise musical structure, visual density, lane coverage, and a strong finale over minimising cost.',
  '  - Slots sharing the same t are one musical moment. On chorus, drop, climax, and finale accents, assign every safely available tube together.',
  '  - Use lane-local multi-shots as sustained visual beds, then layer precise direct bursts on the remaining free tubes.',
  '  - If every slot cannot be used safely, protect peaks, downbeats, section boundaries, and complete same-time groups before ordinary beats.',
].join('\n');

export const DEFAULT_SHOW_CUE_PRODUCT_CONTEXT_TEXT = [
  'Product context instructions:',
  '  - Treat the catalogue JSON as the complete list of products available for this show.',
  '  - Use catalogue ids exactly as supplied. Never invent product ids, names, or substitute products that are not present.',
  '  - Prefer products whose colours, effect flags, shot count, duration, height, calibre, and description fit the slot vibe and the userPrompt.',
  '  - Multi-shot products are useful for sustained musical sections, but they occupy their parent tube and any launchPositionOverrideIndices for their full durationSeconds.',
  '  - Single-shot products are best for beat hits, accents, transitions, and precise climax moments. For direct singles, slot t is the desired burst, not launch, and the server applies lift-time compensation.',
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

  return [systemPrompt, SHOW_CUE_RUNTIME_GUARDRAILS, styleDirectives, productContext, fieldContext]
    .filter(Boolean)
    .join('\n\n');
}
