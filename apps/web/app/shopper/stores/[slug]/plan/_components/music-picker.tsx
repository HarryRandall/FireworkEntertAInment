/** Optional music selection shares the existing plan region and kit controls. */
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Soundtrack } from '@/lib/shopper/music/contracts';
import { jamendoTrackUrl } from '@/lib/shopper/music/attribution';
import type { SavedPlan } from '@/lib/shopper/planner/contracts';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { useMusicSearch } from './use-music-search';

const ANALYSIS_POLL_MS = 5000; // Five-second status interval while the shared job is pending.
/** Shows attribution, pending beat analysis and an optional Jamendo picker without uploads. */
export function MusicPicker({
  plan,
  pending,
  onMusic,
}: {
  plan: SavedPlan;
  pending: boolean;
  onMusic: (track: string | null, refresh?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = plan.soundtrack;
  const statusError = useAnalysisReady(plan, pending, onMusic);
  return (
    <section data-section="plan-music" aria-label="Soundtrack" className="grid min-w-0 gap-3 px-4">
      <h2 className="text-xl font-semibold">Music for your show</h2>
      {statusError !== undefined ? <p role="alert">{statusError}</p> : null}
      {selected ? (
        <SelectedMusic selected={selected} pending={pending} onMusic={onMusic} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Music is optional. Your show works without a soundtrack.
        </p>
      )}
      <Button
        variant="outline"
        disabled={pending}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? 'Close music search' : 'Pick music'}
      </Button>
      {open ? (
        <MusicSearch
          pending={pending}
          onChoose={(track) => {
            onMusic(track);
          }}
        />
      ) : null}
    </section>
  );
}
function SelectedMusic({
  selected,
  pending,
  onMusic,
}: {
  selected: Soundtrack;
  pending: boolean;
  onMusic: (track: string | null, refresh?: boolean) => void;
}) {
  return (
    <div className="border-border bg-card grid min-w-0 gap-2 rounded-xl border p-4">
      <b className="[overflow-wrap:anywhere]">
        {selected.title} · {selected.artist}
      </b>
      <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">
        {selected.attribution ??
          `${selected.title} by ${selected.artist ?? 'Unknown artist'} · Jamendo`}
      </p>
      <a
        className="text-sm underline"
        href={jamendoTrackUrl(selected.provider_track_id)}
        target="_blank"
        rel="noreferrer"
      >
        Track on Jamendo
      </a>
      {selected.licence_url !== null ? (
        <a
          href={selected.licence_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline"
        >
          Licence: {selected.licence_code}
        </a>
      ) : null}
      <p role="status" className="text-sm">
        {selected.pinned_analysis_id !== null
          ? 'Timed to this track. Its analysis is saved with your plan.'
          : 'Analysing this track. Your show is planned without beats for now.'}
      </p>
      {selected.playback_url === null ? (
        <p role="alert">Soundtrack audio is unavailable. Remove music to watch silently.</p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Commercial use is not licensed. Check permission before public performance.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            onMusic(null);
          }}
        >
          Remove music
        </Button>
        {selected.pinned_analysis_id === null ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              onMusic(selected.provider_track_id, true);
            }}
          >
            Check analysis
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MusicSearch({
  pending,
  onChoose,
}: {
  pending: boolean;
  onChoose: (track: string) => void;
}) {
  const [query, setQuery] = useState('');
  const state = useMusicSearch();
  return (
    <div className="grid min-w-0 gap-3">
      {state.status === 'not_configured' ? (
        <p role="status">Music search is not configured. You can keep planning without music.</p>
      ) : (
        <form
          className="flex min-w-0 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            state.search(query).catch(console.error);
          }}
        >
          <label className="grid min-w-0 flex-1 gap-1 text-sm">
            Track or artist
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              disabled={pending}
            />
          </label>
          <Button
            className="self-end"
            disabled={pending || state.status === 'loading'}
            type="submit"
          >
            Search
          </Button>
        </form>
      )}
      {state.status === 'loading' ? <p role="status">Searching Jamendo...</p> : null}
      {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
      {state.status === 'ok' && query !== '' && state.tracks.length === 0 ? (
        <p role="status">No tracks found. Try another track or artist.</p>
      ) : null}
      <ul className="grid min-w-0 gap-3">
        {state.tracks.map((track) => (
          <li
            key={track.provider_track_id}
            className="border-border bg-card grid min-w-0 gap-2 rounded-xl border p-4"
          >
            <b className="[overflow-wrap:anywhere]">{track.title}</b>
            <span className="text-sm [overflow-wrap:anywhere]">{track.artist}</span>
            <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
              {track.attribution}
            </p>
            <a
              className="text-sm underline"
              href={jamendoTrackUrl(track.provider_track_id)}
              target="_blank"
              rel="noreferrer"
            >
              Track on Jamendo
            </a>
            <a
              className="text-sm underline"
              href={track.licence_url}
              target="_blank"
              rel="noreferrer"
            >
              {track.licence_code}
            </a>
            <Button
              aria-label={`Choose ${track.title}`}
              disabled={pending}
              onClick={() => {
                onChoose(track.provider_track_id);
              }}
            >
              Choose track
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
function useAnalysisReady(
  plan: SavedPlan,
  pending: boolean,
  onMusic: (track: string | null, refresh?: boolean) => void,
) {
  const attempted = useRef<string | null>(null);
  const [statusError, setStatusError] = useState<{ track: string; message: string }>();
  useEffect(() => {
    const requestKey = `${plan.id}:${plan.plan_candidates.map((item) => `${item.id}:${String(item.revision)}`).join(',')}`;
    if (attempted.current === requestKey) return;
    const soundtrack = plan.soundtrack;
    if (!soundtrack || soundtrack.pinned_analysis_id !== null || pending) return;
    const providerTrackId = soundtrack.provider_track_id;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const response = await fetch(`/api/shopper/music?session=${plan.id}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Analysis status unavailable');
        const result: unknown = await response.json();
        if (controller.signal.aborted) return;
        setStatusError(undefined);
        if (analysisReady(result)) {
          attempted.current = requestKey;
          onMusic(providerTrackId, true);
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Music analysis status failed', error);
        setStatusError({
          track: providerTrackId,
          message:
            'Could not check music analysis. Your show is kept. Use Check analysis to try again.',
        });
      }
      timer = setTimeout(() => {
        check().catch(console.error);
      }, ANALYSIS_POLL_MS);
    }
    timer = setTimeout(() => {
      check().catch(console.error);
    }, ANALYSIS_POLL_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [plan, pending, onMusic]);
  return plan.soundtrack?.provider_track_id === statusError?.track &&
    plan.soundtrack?.pinned_analysis_id === null
    ? statusError?.message
    : undefined;
}

function analysisReady(result: unknown): boolean {
  return (
    typeof result === 'object' && result !== null && 'ready' in result && result.ready === true
  );
}
