/**
 * Show style presets.
 *
 * A style is the user-facing creative direction picked in the new-show wizard.
 * Each style maps to a generation engine and, for LLM styles, a block of
 * style directives layered on top of the base system prompt. This file is
 * client-safe: no server-only imports, so the wizard can render the picker
 * from the same source of truth the runner uses.
 */

export const SHOW_STYLE_KEYS = ['signature', 'cinematic', 'minimalist', 'beat_test'] as const;

export type ShowStyleKey = (typeof SHOW_STYLE_KEYS)[number];

/** Which generation path the style uses. */
export type ShowStyleEngine = 'llm' | 'beat';

export type ShowStyleDefinition = {
  key: ShowStyleKey;
  name: string;
  tagline: string;
  description: string;
  engine: ShowStyleEngine;
  /** Extra system-prompt directives layered on top of the base prompt. */
  promptDirectives: string | null;
};

export const DEFAULT_SHOW_STYLE: ShowStyleKey = 'signature';

export const SHOW_STYLES: Record<ShowStyleKey, ShowStyleDefinition> = {
  signature: {
    key: 'signature',
    name: 'Signature',
    tagline: 'Big, beat-driven, crowd-pleasing',
    description:
      'The flagship ShowCrafter look: choruses saturate every tube, buildups ramp hard, and the finale empties the racks.',
    engine: 'llm',
    promptDirectives: [
      'Style: SIGNATURE (high-energy crowd-pleaser).',
      '  - Choruses and drops saturate every safe musical moment: start lane-local multi-shot beds at section boundaries, then stack the remaining free tubes on db:1 accents.',
      '  - Buildups must audibly ramp - increase density and product size beat over beat into the drop; the last beat before the drop is em:2.',
      '  - Reserve your 2-3 largest-calibre, highest products for fin:1 (finale window) slots and stack every free tube on its structural accents.',
      '  - Match product size to em tiers: em:2 gets the biggest, em:1 medium, em:0 small singles.',
      '  - Favour bold, saturated colours and aggressive effect rotation (crackle, strobe, crossette).',
    ].join('\n'),
  },
  cinematic: {
    key: 'cinematic',
    name: 'Cinematic build',
    tagline: 'A story with a slow open and a huge payoff',
    description:
      'Opens sparse and elegant, grows tension through every verse, and pays everything off in a gold-heavy finale.',
    engine: 'llm',
    promptDirectives: [
      'Style: CINEMATIC BUILD (narrative arc).',
      '  - Open sparse and elegant: single shells with long trails, about 40-50% fill in the intro, firing only on db:1 downbeats.',
      '  - Each section should feel larger than the last - track a rising arc across the whole song, climbing em tiers as energy grows.',
      '  - Use willows, horsetails, and falling-leaves effects for emotional moments; save strobes for em:2 peaks.',
      '  - The fin:1 finale window is gold-dominant: willows, glitter, and crackle layered across all tubes, with the largest products held back for it.',
      '  - Never spike the energy early; the loudest 20 seconds of the show must be the last 20 seconds of loud music.',
    ].join('\n'),
  },
  minimalist: {
    key: 'minimalist',
    name: 'Minimalist elegance',
    tagline: 'Fewer, better moments',
    description:
      'Restrained and precise. Single shells placed deliberately on the strongest beats, with space to breathe between them.',
    engine: 'llm',
    promptDirectives: [
      'Style: MINIMALIST ELEGANCE (restraint).',
      '  - Target around 55-65% overall fill; silence is part of the design.',
      '  - Prefer single-shot shells with clean shapes (peony, chrysanthemum, ring) over dense cakes.',
      '  - Keep a narrow palette: at most two colour families plus white/silver.',
      '  - Fire only on the strongest beats - downbeats, climaxes, and section boundaries.',
      '  - The finale is fuller but never chaotic; think synchronised pairs, not barrage.',
    ].join('\n'),
  },
  beat_test: {
    key: 'beat_test',
    name: 'Beat precision',
    tagline: 'Every chosen burst lands exactly on a beat',
    description:
      'Beat-matched bursts stack across free firing positions while sustained multi-shot beds make choruses, drops, and the finale feel full.',
    engine: 'beat',
    promptDirectives: null,
  },
};

export const SHOW_STYLE_LIST: readonly ShowStyleDefinition[] = SHOW_STYLE_KEYS.map(
  (key) => SHOW_STYLES[key],
);

export function isShowStyleKey(value: unknown): value is ShowStyleKey {
  return typeof value === 'string' && (SHOW_STYLE_KEYS as readonly string[]).includes(value);
}

export function asShowStyleKey(value: unknown): ShowStyleKey {
  return isShowStyleKey(value) ? value : DEFAULT_SHOW_STYLE;
}
