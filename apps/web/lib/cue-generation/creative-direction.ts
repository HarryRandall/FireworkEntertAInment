import type { ShowStyleKey } from './show-styles';

export type CreativeDirection = {
  style: ShowStyleKey;
  density: 'sparse' | 'balanced' | 'dense';
  precise: boolean;
  surprise: boolean;
  quietMiddle: boolean;
  softEnding: boolean;
  bigEnding: boolean;
};

/** Deterministic interpretation shared by fast planning and focused tests. */
export function parseCreativeDirection(text: string, style: ShowStyleKey): CreativeDirection {
  const normalised = text.toLowerCase();
  const sparse = includesAny(normalised, [
    'minimalist',
    'minimal',
    'sparse',
    'restrained',
    'understated',
    'room to breathe',
  ]);
  const dense = includesAny(normalised, [
    'relentless',
    'nonstop',
    'non-stop',
    'dense',
    'high energy',
    'full sky',
    'all out',
  ]);
  return {
    style,
    density: sparse ? 'sparse' : dense ? 'dense' : 'balanced',
    precise: includesAny(normalised, [
      'precise',
      'on beat',
      'on-beat',
      'beat synced',
      'beat-synced',
      'exact on beat',
      'exact on the beat',
      'synchronised',
      'synchronized',
    ]),
    surprise: includesAny(normalised, ['surprise', 'unexpected', 'false ending', 'fake ending']),
    quietMiddle: includesAny(normalised, [
      'quiet midpoint',
      'quiet middle',
      'quiet moment',
      'moment of quiet',
      'midpoint pause',
      'moment of silence',
    ]),
    softEnding: includesAny(normalised, ['soft ending', 'gentle ending', 'fade out', 'taper out']),
    bigEnding: includesAny(normalised, [
      'big finale',
      'huge finale',
      'massive finale',
      'crackling finale',
      'fills the sky',
      'all-out finale',
    ]),
  };
}

function includesAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}
