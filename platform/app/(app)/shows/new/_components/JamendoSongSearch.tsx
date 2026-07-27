/** Jamendo soundtrack picker: a search-styled trigger opening a browse/search dialog with seekable previews. */
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ChevronRight,
  ExternalLink,
  Library,
  Loader2,
  Music,
  Pause,
  Play,
  Search,
  Shuffle,
  X,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDuration } from '@/lib/show-domain';
import {
  JAMENDO_GENRES,
  type JamendoGenre,
  type JamendoSearchTrack,
} from '@/lib/music-library.types';

const GENRE_LABELS: Record<JamendoGenre, string> = {
  ambient: 'Ambient',
  cinematic: 'Cinematic',
  electronic: 'Electronic',
  rock: 'Rock',
  pop: 'Pop',
  classical: 'Classical',
  jazz: 'Jazz',
  hiphop: 'Hip-hop',
  folk: 'Folk',
  lounge: 'Lounge',
};

function isJamendoTrack(value: unknown): value is JamendoSearchTrack {
  if (typeof value !== 'object' || value === null) return false;
  const track = value as Partial<JamendoSearchTrack>;
  return (
    track.provider === 'jamendo' &&
    typeof track.trackId === 'string' &&
    typeof track.title === 'string' &&
    typeof track.artist === 'string' &&
    typeof track.durationSeconds === 'number' &&
    typeof track.previewUrl === 'string' &&
    typeof track.sourceUrl === 'string' &&
    typeof track.licenceName === 'string' &&
    typeof track.licenceUrl === 'string' &&
    (track.imageUrl === null || track.imageUrl === undefined || typeof track.imageUrl === 'string')
  );
}

function tracksFrom(value: unknown): JamendoSearchTrack[] {
  return typeof value === 'object' &&
    value !== null &&
    'tracks' in value &&
    Array.isArray(value.tracks)
    ? value.tracks.filter(isJamendoTrack)
    : [];
}

function responseError(value: unknown, fallback: string): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string' &&
    value.error.trim()
  ) {
    return value.error;
  }
  return fallback;
}

function clockTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, '0')}`;
}

const WAVEFORM_BAR_COUNT = 56;
const CLIENT_BROWSE_CACHE_MS = 5 * 60 * 1000;

/**
 * Deterministic pseudo-waveform seeded by the track id. Jamendo does not expose
 * amplitude peaks, so this is a stable, decorative "shape" for the track that
 * also serves as the seek target; it is not decoded audio.
 */
function waveformBars(seed: string): number[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bars: number[] = [];
  for (let i = 0; i < WAVEFORM_BAR_COUNT; i += 1) {
    // Bias towards a fuller centre so it reads like a song envelope.
    const envelope = Math.sin((i / (WAVEFORM_BAR_COUNT - 1)) * Math.PI) * 0.35 + 0.65;
    bars.push(Math.max(0.18, Math.min(1, (0.35 + rand() * 0.65) * envelope)));
  }
  return bars;
}

const LICENCE_NOTE =
  'Only downloadable Creative Commons tracks are shown. Search uses no AI credits; your completed analysis is reused when available.';

export function JamendoSongSearch({
  onSelect,
  hasSelection = false,
}: {
  onSelect: (track: JamendoSearchTrack) => Promise<void>;
  hasSelection?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [genre, setGenre] = useState<JamendoGenre | null>(null);

  const [tracks, setTracks] = useState<JamendoSearchTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [importingTrackId, setImportingTrackId] = useState<string | null>(null);
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [previewLoadingTrackId, setPreviewLoadingTrackId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestTokenRef = useRef(0);
  // Mirror of the visible list so an async "load more" always appends to the
  // latest committed tracks, never a stale closure value.
  const tracksRef = useRef<JamendoSearchTrack[]>([]);
  // Per-genre browse pages, kept for the session so re-opening or switching back
  // is instant and spends no Jamendo API allowance.
  const browseCacheRef = useRef<
    Map<
      string,
      {
        tracks: JamendoSearchTrack[];
        nextOffset: number;
        hasMore: boolean;
        cachedAt: number;
      }
    >
  >(new Map());

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  function stopPreview() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewingTrackId(null);
    setPreviewLoadingTrackId(null);
    setPreviewTime(0);
    setPreviewDuration(0);
  }

  async function loadBrowse(
    nextGenre: JamendoGenre | null,
    offset: number,
    append: boolean,
    useCache = true,
    count = 20,
  ): Promise<JamendoSearchTrack[]> {
    const cacheKey = nextGenre ?? 'all';

    // Instant path: a fresh genre view we already have from earlier this session.
    if (!append && useCache) {
      const cached = browseCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= CLIENT_BROWSE_CACHE_MS) {
        requestTokenRef.current += 1;
        stopPreview();
        setError(null);
        setMode('browse');
        setGenre(nextGenre);
        setHasSearched(true);
        setTracks(cached.tracks);
        setNextOffset(cached.nextOffset);
        setHasMore(cached.hasMore);
        setLoading(false);
        return cached.tracks;
      }
      browseCacheRef.current.delete(cacheKey);
    }

    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      stopPreview();
    }
    setError(null);
    setMode('browse');
    setGenre(nextGenre);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        mode: 'browse',
        offset: String(offset),
        count: String(count),
      });
      if (nextGenre) params.set('genre', nextGenre);
      const res = await fetch(`/api/music-library/jamendo?${params.toString()}`, {
        cache: 'no-store',
      });
      const value: unknown = await res.json();
      if (!res.ok) throw new Error(responseError(value, 'Browsing failed. Please try again.'));
      if (requestTokenRef.current !== token) return [];
      const next = tracksFrom(value);
      const existing = append ? tracksRef.current : [];
      const seen = new Set(existing.map((track) => track.trackId));
      const additions = next.filter((track) => !seen.has(track.trackId));
      const resolvedTracks = append ? [...existing, ...additions] : next;
      const resolvedOffset =
        typeof value === 'object' && value !== null && 'nextOffset' in value
          ? Number((value as { nextOffset: unknown }).nextOffset) || offset
          : offset;
      const resolvedHasMore =
        typeof value === 'object' && value !== null && 'hasMore' in value
          ? Boolean((value as { hasMore: unknown }).hasMore)
          : false;
      setTracks(resolvedTracks);
      setNextOffset(resolvedOffset);
      setHasMore(resolvedHasMore);
      if (useCache) {
        browseCacheRef.current.set(cacheKey, {
          tracks: resolvedTracks,
          nextOffset: resolvedOffset,
          hasMore: resolvedHasMore,
          cachedAt: Date.now(),
        });
      }
      return next;
    } catch (err) {
      if (requestTokenRef.current !== token) return [];
      if (!append) setTracks([]);
      setError(err instanceof Error ? err.message : 'Browsing failed.');
      return [];
    } finally {
      if (requestTokenRef.current === token) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  async function searchSongs() {
    const cleaned = query.trim().replace(/\s+/g, ' ');
    if (cleaned.length < 2) {
      setError('Enter at least two characters to search for a song.');
      return;
    }
    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;
    setLoading(true);
    setError(null);
    setMode('search');
    setHasSearched(true);
    setHasMore(false);
    stopPreview();
    try {
      const res = await fetch(`/api/music-library/jamendo?q=${encodeURIComponent(cleaned)}`, {
        cache: 'no-store',
      });
      const value: unknown = await res.json();
      if (!res.ok) throw new Error(responseError(value, 'Song search failed. Please try again.'));
      if (requestTokenRef.current !== token) return;
      setTracks(tracksFrom(value));
    } catch (err) {
      if (requestTokenRef.current !== token) return;
      setTracks([]);
      setError(err instanceof Error ? err.message : 'Song search failed.');
    } finally {
      if (requestTokenRef.current === token) setLoading(false);
    }
  }

  async function surpriseMe() {
    setQuery('');
    const pick = JAMENDO_GENRES[Math.floor(Math.random() * JAMENDO_GENRES.length)];
    const offset = Math.floor(Math.random() * 6) * 30;
    const results = await loadBrowse(pick, offset, false, false, 20);
    if (results.length > 0) {
      // Land on an actual track and start previewing it, not just the category.
      togglePreview(results[Math.floor(Math.random() * results.length)]);
    }
  }

  function openDialog() {
    setOpen(true);
    if (!hasSearched) void loadBrowse(null, 0, false);
  }

  function togglePreview(track: JamendoSearchTrack) {
    const current = audioRef.current;
    if (previewingTrackId === track.trackId && current) {
      if (!current.paused) {
        current.pause();
        setPreviewingTrackId(null);
      } else {
        void current.play().catch(() => stopPreview());
        setPreviewingTrackId(track.trackId);
      }
      return;
    }

    current?.pause();
    const audio = new Audio(track.previewUrl);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () =>
      setPreviewDuration(Number.isFinite(audio.duration) ? audio.duration : track.durationSeconds);
    audio.ontimeupdate = () => setPreviewTime(audio.currentTime);
    audio.onplaying = () => setPreviewLoadingTrackId(null);
    audio.onended = () => {
      setPreviewingTrackId(null);
      setPreviewLoadingTrackId(null);
      setPreviewTime(0);
    };
    audioRef.current = audio;
    setPreviewTime(0);
    setPreviewDuration(track.durationSeconds);
    setPreviewLoadingTrackId(track.trackId);
    setPreviewingTrackId(track.trackId);
    void audio.play().catch(() => {
      stopPreview();
      setError('The song preview could not start. Try again.');
    });
  }

  function seekPreview(fraction: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const total =
      Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : previewDuration;
    if (!total) return;
    const next = Math.min(Math.max(fraction, 0), 1) * total;
    audio.currentTime = next;
    setPreviewTime(next);
  }

  function handleScrubberPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    seekPreview((event.clientX - rect.left) / rect.width);
  }

  function handleScrubberKey(event: KeyboardEvent<HTMLDivElement>) {
    const total = previewDuration || 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      seekPreview((previewTime + 5) / total);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      seekPreview((previewTime - 5) / total);
    } else if (event.key === 'Home') {
      event.preventDefault();
      seekPreview(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      seekPreview(1);
    }
  }

  async function selectTrack(track: JamendoSearchTrack) {
    stopPreview();
    setImportingTrackId(track.trackId);
    setError(null);
    try {
      await onSelect(track);
      setOpen(false);
    } catch (err) {
      const unavailable =
        typeof err === 'object' && err !== null && 'unavailable' in err && err.unavailable === true;
      if (unavailable) {
        const remaining = tracksRef.current.filter(
          (candidate) => candidate.trackId !== track.trackId,
        );
        tracksRef.current = remaining;
        setTracks(remaining);
        for (const [key, cached] of browseCacheRef.current) {
          browseCacheRef.current.set(key, {
            ...cached,
            tracks: cached.tracks.filter((candidate) => candidate.trackId !== track.trackId),
          });
        }
      }
      const message =
        err instanceof Error ? err.message : 'The selected song could not be attached.';
      setError(unavailable ? `${message} It has been removed from these results.` : message);
    } finally {
      setImportingTrackId(null);
    }
  }

  const busy = loading || importingTrackId !== null;

  return (
    <section
      aria-labelledby="jamendo-search-title"
      className="rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-elevated)] p-5 shadow-sm"
    >
      <div className="flex items-center gap-1.5">
        <h3
          id="jamendo-search-title"
          className="text-base font-semibold text-[color:var(--color-content-emphasis)]"
        >
          Music library
        </h3>
        <InfoTooltip text={LICENCE_NOTE} />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[color:var(--color-content-subtle)]">
        {hasSelection
          ? 'Your soundtrack is attached. You can still explore the library and choose another.'
          : 'Browse a free, licence-cleared library for a track to lead your show.'}
      </p>

      <button
        type="button"
        onClick={openDialog}
        className="focus-visible:ring-ring group mt-3 flex w-full items-center gap-3 rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-subtle)] px-3 py-3 text-left transition-[border-color,background-color,box-shadow] hover:border-[color:var(--primary)]/45 hover:bg-[color:var(--color-bg-default)] hover:shadow-sm focus-visible:ring-3 focus-visible:outline-none"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)] text-[color:var(--primary)]">
          <Library size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[color:var(--color-content-emphasis)]">
            {hasSelection ? 'Browse more music' : 'Browse music library'}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[color:var(--color-content-subtle)]">
            Search by track, artist, mood, or genre
          </span>
        </span>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 text-[color:var(--color-content-muted)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) stopPreview();
          setOpen(next);
        }}
      >
        <DialogContent className="grid h-[88vh] max-h-[900px] w-[96vw] grid-rows-[auto_1fr] gap-0 p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-[color:var(--color-border-subtle)] p-5 pb-4">
            <DialogTitle>Add music</DialogTitle>
            <DialogDescription>
              Preview a track, then attach it. Only downloadable Creative Commons tracks appear.
            </DialogDescription>

            <div role="search" className="mt-2 flex gap-2">
              <label htmlFor="jamendo-song-search" className="sr-only">
                Search tracks
              </label>
              <div className="relative flex-1">
                <Input
                  id="jamendo-song-search"
                  type="search"
                  value={query}
                  maxLength={80}
                  iconLeft={<Search size={15} aria-hidden="true" />}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    event.stopPropagation();
                    void searchSongs();
                  }}
                  placeholder="Song, artist, genre, or mood"
                  autoComplete="off"
                  disabled={busy}
                  className={query ? 'pr-9' : undefined}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      document.getElementById('jamendo-song-search')?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-[color:var(--color-content-subtle)] transition-colors hover:text-[color:var(--color-content-emphasis)]"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={() => void searchSongs()}
                disabled={busy || query.trim().length < 2}
                className="shrink-0"
              >
                <Search size={15} aria-hidden="true" />
                Search
              </Button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <GenreChip
                label="All"
                active={mode === 'browse' && genre === null}
                disabled={busy}
                onClick={() => void loadBrowse(null, 0, false)}
              />
              {JAMENDO_GENRES.map((key) => (
                <GenreChip
                  key={key}
                  label={GENRE_LABELS[key]}
                  active={mode === 'browse' && genre === key}
                  disabled={busy}
                  onClick={() => void loadBrowse(key, 0, false)}
                />
              ))}
              <button
                type="button"
                onClick={() => void surpriseMe()}
                disabled={busy}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[color:var(--primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Shuffle size={13} aria-hidden="true" />
                Surprise me
              </button>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto px-4 py-3">
            {error ? (
              <p
                role="alert"
                className="mb-3 rounded-lg border border-[color:var(--color-status-danger)]/35 bg-[color-mix(in_srgb,var(--color-status-danger)_7%,transparent)] px-3 py-2 text-xs text-[color:var(--color-status-danger)]"
              >
                {error}
              </p>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[color:var(--color-content-subtle)]">
                <Loader2
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {mode === 'search' ? 'Searching Jamendo' : 'Loading tracks'}
              </div>
            ) : tracks.length === 0 && hasSearched && !error ? (
              <p className="py-10 text-center text-sm text-[color:var(--color-content-subtle)]">
                {mode === 'search'
                  ? 'No tracks matched. Try another search or browse by genre.'
                  : 'No tracks to show right now. Try a different genre.'}
              </p>
            ) : (
              <ul className="flex w-full flex-col gap-2">
                {tracks.map((track) => (
                  <TrackRow
                    key={track.trackId}
                    track={track}
                    previewing={previewingTrackId === track.trackId}
                    previewLoading={previewLoadingTrackId === track.trackId}
                    importing={importingTrackId === track.trackId}
                    importLocked={importingTrackId !== null}
                    progress={
                      previewingTrackId === track.trackId && previewDuration > 0
                        ? Math.min(previewTime / previewDuration, 1)
                        : 0
                    }
                    previewTime={previewTime}
                    previewDuration={previewDuration}
                    onTogglePreview={() => togglePreview(track)}
                    onSelect={() => void selectTrack(track)}
                    onScrubberPointer={handleScrubberPointer}
                    onScrubberKey={handleScrubberKey}
                  />
                ))}
              </ul>
            )}

            {!loading && mode === 'browse' && hasMore ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void loadBrowse(genre, nextOffset, true, true, 5)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <Loader2
                      size={14}
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : null}
                  {loadingMore ? 'Loading' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function GenreChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white'
          : 'border-[color:var(--color-border-default)] text-[color:var(--color-content-subtle)] hover:border-[color:var(--color-border-strong,var(--color-content-subtle))] hover:text-[color:var(--color-content-emphasis)]'
      }`}
    >
      {label}
    </button>
  );
}

function TrackRow({
  track,
  previewing,
  previewLoading,
  importing,
  importLocked,
  progress,
  previewTime,
  previewDuration,
  onTogglePreview,
  onSelect,
  onScrubberPointer,
  onScrubberKey,
}: {
  track: JamendoSearchTrack;
  previewing: boolean;
  previewLoading: boolean;
  importing: boolean;
  importLocked: boolean;
  progress: number;
  previewTime: number;
  previewDuration: number;
  onTogglePreview: () => void;
  onSelect: () => void;
  onScrubberPointer: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onScrubberKey: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const bars = useMemo(
    () =>
      Array.isArray(track.peaks) && track.peaks.length > 0
        ? track.peaks
        : waveformBars(track.trackId),
    [track.peaks, track.trackId],
  );

  return (
    <li>
      <div
        onClick={() => {
          // Once playing, only the pause button stops it; row clicks never pause.
          if (!importLocked && !previewing) onTogglePreview();
        }}
        className={`group cursor-pointer rounded-lg border p-2.5 transition-colors ${
          previewing
            ? 'border-[color:var(--primary)]/40 bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]'
            : 'border-[color:var(--color-border-subtle)] hover:border-[color:var(--color-border-default)] hover:bg-[color:var(--color-bg-subtle)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`${previewing ? 'Pause' : 'Preview'} ${track.title} by ${track.artist}`}
            onClick={(event) => {
              event.stopPropagation();
              if (!importLocked) onTogglePreview();
            }}
            disabled={importLocked}
            className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {track.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.imageUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[color:var(--color-content-subtle)]">
                <Music size={18} aria-hidden="true" />
              </span>
            )}
            <span
              className={`absolute inset-0 flex items-center justify-center text-white transition-opacity ${
                previewing
                  ? 'bg-black/45 opacity-100'
                  : 'bg-black/45 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
              }`}
            >
              {previewLoading ? (
                <Loader2
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : previewing ? (
                <Pause size={16} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={16} fill="currentColor" aria-hidden="true" />
              )}
            </span>
          </button>

          <div className="w-52 shrink-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-medium text-[color:var(--color-content-emphasis)]">
                {track.title}
              </span>
              <a
                href={track.sourceUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                aria-label={`Open ${track.title} on Jamendo`}
                className="shrink-0 text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)]"
              >
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            </div>
            <p className="truncate text-xs text-[color:var(--color-content-subtle)]">
              {track.artist} · {formatDuration(track.durationSeconds)} ·{' '}
              <a
                href={track.licenceUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="underline underline-offset-2"
              >
                {track.licenceName}
              </a>
            </p>
          </div>

          <div
            {...(previewing
              ? {
                  role: 'slider',
                  tabIndex: 0,
                  'aria-label': `Seek preview of ${track.title}`,
                  'aria-valuemin': 0,
                  'aria-valuemax': Math.round(previewDuration),
                  'aria-valuenow': Math.round(previewTime),
                  'aria-valuetext': `${clockTime(previewTime)} of ${clockTime(previewDuration)}`,
                  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
                    event.stopPropagation();
                    onScrubberPointer(event);
                  },
                  onKeyDown: onScrubberKey,
                }
              : { 'aria-hidden': true })}
            className={`relative hidden h-8 min-w-0 flex-1 sm:block ${
              previewing ? 'cursor-pointer touch-none select-none' : 'opacity-70'
            }`}
          >
            <div className="flex h-full items-center gap-[2px]">
              {bars.map((height, index) => (
                <span
                  key={index}
                  className="min-w-[2px] flex-1 rounded-full bg-[color:var(--color-border-default)] group-hover:bg-[color:var(--color-content-subtle)]/60"
                  style={{ height: `${Math.round(height * 100)}%` }}
                />
              ))}
            </div>
            {previewing ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex h-full items-center gap-[2px] motion-safe:transition-[clip-path] motion-safe:duration-150 motion-safe:ease-linear"
                style={{ clipPath: `inset(0 ${Math.max(0, 100 - progress * 100)}% 0 0)` }}
              >
                {bars.map((height, index) => (
                  <span
                    key={index}
                    className="min-w-[2px] flex-1 rounded-full bg-[color:var(--primary)]"
                    style={{ height: `${Math.round(height * 100)}%` }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            disabled={importLocked}
            className="shrink-0"
          >
            {importing ? (
              <Loader2
                size={14}
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {importing ? 'Attaching' : 'Use track'}
          </Button>
        </div>
      </div>
    </li>
  );
}
