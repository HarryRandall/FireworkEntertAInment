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
type ShowStyleEngine = 'llm' | 'beat';

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
      'The flagship ShowCrafter look: bold choruses, builds that ramp hard, and a finale that empties the racks.',
    engine: 'llm',
    promptDirectives: [
      'Style: SIGNATURE (high-energy crowd-pleaser).',
      '  - Choruses and drops are peaks at density 2-3 with mirror or unison motifs; verses stay at 1-2 so the choruses land.',
      '  - Builds climb into the drop with crackle and glitter.',
      '  - Bold, saturated palettes and aggressive effect rotation (crackle, strobe, crossette) in peaks.',
      '  - The finale is density 3-4 in unison with the largest products as heroes.',
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
      '  - Open sparse and elegant: density 0-1, willows and long trails, mirror motif.',
      '  - Each section feels larger than the last; raise density and product size gradually across the song.',
      '  - Willows, horsetails and falling leaves for emotional passages; save strobes for the biggest peaks.',
      '  - The finale is gold-dominant (willow, glitter, crackle) and the loudest passage of the show.',
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
      '  - Keep most sections at density 0-1 and peaks at 2; silence is part of the design.',
      '  - Prefer clean single shells (peony, chrysanthemum, ring) over dense cakes.',
      '  - At most two colour families plus white or silver across the show.',
      '  - The finale is fuller but never chaotic: mirror motif at density 2-3.',
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
