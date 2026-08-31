/** Client-safe contracts for provider-sourced soundtrack search and attribution. */

export type SoundtrackAttribution = {
  provider: 'jamendo';
  trackId: string;
  title: string;
  artist: string;
  sourceUrl: string;
  licenceName: string;
  licenceUrl: string;
  imageUrl?: string | null;
};

export type JamendoSearchTrack = SoundtrackAttribution & {
  durationSeconds: number;
  previewUrl: string;
  imageUrl: string | null;
  /** Normalised waveform amplitudes (0-1) from Jamendo, downsampled; null if unavailable. */
  peaks: number[] | null;
};

/** Genre tags offered for browsing, mapped to Jamendo fuzzy tags. Client-safe. */
export const JAMENDO_GENRES = [
  'ambient',
  'cinematic',
  'electronic',
  'rock',
  'pop',
  'classical',
  'jazz',
  'hiphop',
  'folk',
  'lounge',
] as const;

export type JamendoGenre = (typeof JAMENDO_GENRES)[number];

export function isJamendoGenre(value: string): value is JamendoGenre {
  return (JAMENDO_GENRES as readonly string[]).includes(value);
}

/** One page of popular tracks for the browse grid. */
export type JamendoBrowsePage = {
  tracks: JamendoSearchTrack[];
  nextOffset: number;
  hasMore: boolean;
};
