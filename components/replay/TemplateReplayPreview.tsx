'use client';

/**
 * TemplateReplayPreview — small 3D replay preview used on template
 * cards in the library route and on the template detail page. In
 * "card" mode only the first ~10 seconds simulate to keep the initial
 * seek cheap when many cards are visible.
 */
import dynamic from 'next/dynamic';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import type { ShowTemplate, ShowTemplateCue } from '@/lib/admin.types';
import type { FireworkSpecification } from '@/lib/show-domain';
import { formatBudget } from '@/lib/show-domain';
import {
  PreviewFullscreenBackdrop,
  usePreviewFullscreen,
} from '@/components/admin/previewFullscreen';
import { ReplayCanvasSkeleton } from '@/components/replay/ReplayCanvasSkeleton';
import { ReplayTransportControls } from '@/components/replay/ReplayTransportControls';
import {
  buildTemplateReplayCues,
  getCurrentTemplateReplayCue,
  TEMPLATE_REPLAY_ACTIVE_CUE_EVENT,
  type TemplateReplayActiveCueEventDetail,
} from '@/components/explore/template-replay-cues';
import { cn } from '@/lib/utils';

type TemplateReplayPreviewProps = {
  template: ShowTemplate;
  specifications: FireworkSpecification[];
  mode?: 'card' | 'detail';
  detailAppearance?: 'default' | 'borderless';
  /** Optional soundtrack for detail previews. Playback is driven by this media clock. */
  audioUrl?: string | null;
  isCardHovered?: boolean;
  /** Card mode only: override whether the replay playhead is currently advancing. */
  isCardPlaybackActive?: boolean;
  /** Card mode only: keep the Three.js preview mounted after playback pauses. */
  keepCardCanvasMounted?: boolean;
  /** Card mode only: reset to the poster frame when playback stops. */
  resetCardPlayheadOnIdle?: boolean;
  /** Override the card-mode container classes (e.g. for a portrait cover). */
  cardClassName?: string;
  /** Hide the built-in like/budget badge and bottom accent strip in card mode. */
  showCardOverlays?: boolean;
  /**
   * Card mode only: skip the dark default background and the idle skeleton,
   * and only mount/play the heavy 3D canvas while hovered. Lets the parent
   * render a lightweight poster behind the preview for the idle state.
   */
  lazyHoverMount?: boolean;
  /** Fired once the replay canvas has painted its first developed frame. */
  onReady?: () => void;
};

// Card previews only simulate this window — keeps initial seek fast while
// giving hover playback enough runway to read as a real snippet of the show.
const CARD_PREVIEW_SECONDS = 18;
// Coalesce heavyweight `elapsed` commits during a timeline drag to ~15Hz so a
// fast scrub does not re-render the preview on every input event. The engine
// ref and the display state still update at full input rate.
const SCRUB_COMMIT_INTERVAL_MS = 67;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/components/replay/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <ReplayCanvasSkeleton />,
  },
);
const MemoizedFireworkReplayCanvas = memo(LazyFireworkReplayCanvas);
MemoizedFireworkReplayCanvas.displayName = 'MemoizedFireworkReplayCanvas';

function posterTimeFor(slug: string, cues: ShowTemplateCue[]): number {
  if (cues.length === 0) return 0;
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const cue = cues[hash % cues.length];
  return Math.max(0, cue.timeSeconds + 1.6);
}

function hoverStartTimeFor(cues: ShowTemplateCue[]): number {
  const firstCueTime = cues.reduce<number | null>(
    (earliest, cue) => (earliest == null ? cue.timeSeconds : Math.min(earliest, cue.timeSeconds)),
    null,
  );
  return Math.max(0, (firstCueTime ?? 0) - 0.3);
}

function firstCueTimeFor(cues: ShowTemplateCue[]): number {
  const firstCueTime = cues.reduce<number | null>(
    (earliest, cue) => (earliest == null ? cue.timeSeconds : Math.min(earliest, cue.timeSeconds)),
    null,
  );
  return firstCueTime ?? 0;
}

export function TemplateReplayPreview({
  template,
  specifications,
  mode = 'card',
  detailAppearance = 'default',
  audioUrl = null,
  isCardHovered = false,
  isCardPlaybackActive,
  keepCardCanvasMounted = false,
  resetCardPlayheadOnIdle = true,
  cardClassName,
  showCardOverlays = true,
  lazyHoverMount = false,
  onReady,
}: TemplateReplayPreviewProps) {
  const isDetail = mode === 'detail';

  // In card mode, simulate a short window around the first cue. This keeps
  // hover playback near-instant even when the source show starts later.
  const cardPreviewWindowStart = useMemo(
    () => Math.max(0, firstCueTimeFor(template.previewCues) - 0.3),
    [template.previewCues],
  );
  const visibleCues = useMemo(
    () =>
      isDetail
        ? template.previewCues
        : template.previewCues
            .filter(
              (c) =>
                c.timeSeconds >= cardPreviewWindowStart &&
                c.timeSeconds <= cardPreviewWindowStart + CARD_PREVIEW_SECONDS,
            )
            .map((c) => ({
              ...c,
              timeSeconds: Math.max(0, c.timeSeconds - cardPreviewWindowStart),
            })),
    [cardPreviewWindowStart, isDetail, template.previewCues],
  );

  const suppliedDuration = template.durationSeconds;
  const duration = isDetail
    ? suppliedDuration != null && suppliedDuration > 0
      ? suppliedDuration
      : 30
    : CARD_PREVIEW_SECONDS;

  const posterTime = useMemo(
    () => posterTimeFor(template.slug, visibleCues),
    [template.slug, visibleCues],
  );
  const hoverStartTime = useMemo(() => hoverStartTimeFor(visibleCues), [visibleCues]);
  const [elapsed, setElapsed] = useState(posterTime);
  const [displayElapsed, setDisplayElapsed] = useState(posterTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isVisible, setIsVisible] = useState(isDetail);
  const [isReplayReady, setIsReplayReady] = useState(!isDetail);
  const {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
    fullscreenContainerRef: containerRef,
    fullscreenContainerProps,
  } = usePreviewFullscreen({ dialogLabel: 'Template preview' });
  const elapsedRef = useRef(elapsed);
  const lastUIElapsedRef = useRef(elapsed);
  const lastScrubCommitRef = useRef(0);
  const pendingScrubRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hoverStartTimeRef = useRef(hoverStartTime);
  const startedAt = useRef<number | null>(null);
  const playheadStart = useRef(0);
  const detailAutoplayRef = useRef(false);
  const cardPlaybackActive = isCardPlaybackActive ?? isCardHovered;
  const cardWasPlaybackActiveRef = useRef(false);
  const cardHasStartedPlaybackRef = useRef(false);
  const active = isDetail ? isPlaying : cardPlaybackActive;
  const playbackRate = isDetail ? 1 : 1.15;

  const setPlayhead = useCallback(
    (seconds: number) => {
      const next = Math.max(0, Math.min(duration, seconds));
      elapsedRef.current = next;
      lastUIElapsedRef.current = next;
      setDisplayElapsed(next);
      setElapsed(next);
    },
    [duration],
  );

  const handleReplayReady = useCallback(() => {
    setIsReplayReady(true);
    onReady?.();
  }, [onReady]);

  const cues = useMemo(
    () => buildTemplateReplayCues(visibleCues, specifications),
    [specifications, visibleCues],
  );
  const activeCue = useMemo(
    () => getCurrentTemplateReplayCue(cues, displayElapsed),
    [cues, displayElapsed],
  );

  useEffect(() => {
    if (!isDetail || typeof window === 'undefined') return;
    const detail: TemplateReplayActiveCueEventDetail = {
      templateSlug: template.slug,
      cueId: activeCue?.id ?? null,
    };
    window.dispatchEvent(new CustomEvent(TEMPLATE_REPLAY_ACTIVE_CUE_EVENT, { detail }));
  }, [activeCue?.id, isDetail, template.slug]);

  useEffect(() => {
    if (isDetail || isVisible) return;
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, isDetail, isVisible]);

  useEffect(() => {
    hoverStartTimeRef.current = hoverStartTime;
  }, [hoverStartTime]);

  useEffect(() => {
    if (isDetail) return;
    cardWasPlaybackActiveRef.current = false;
    cardHasStartedPlaybackRef.current = false;
  }, [isDetail, template.slug]);

  useEffect(() => {
    if (isDetail) return;
    if (resetCardPlayheadOnIdle) {
      setPlayhead(isCardHovered ? hoverStartTime : posterTime);
      return;
    }

    if (cardPlaybackActive && !cardWasPlaybackActiveRef.current) {
      if (!cardHasStartedPlaybackRef.current) {
        cardHasStartedPlaybackRef.current = true;
        setPlayhead(hoverStartTime);
      } else if (elapsedRef.current >= duration) {
        setPlayhead(0);
      }
    }
    cardWasPlaybackActiveRef.current = cardPlaybackActive;
  }, [
    cardPlaybackActive,
    duration,
    hoverStartTime,
    isCardHovered,
    isDetail,
    posterTime,
    resetCardPlayheadOnIdle,
    setPlayhead,
  ]);

  useEffect(() => {
    detailAutoplayRef.current = false;
    setIsReplayReady(!isDetail);
  }, [isDetail, template.slug]);

  useEffect(() => {
    if (!isDetail || cues.length === 0 || detailAutoplayRef.current) return;
    detailAutoplayRef.current = true;
    // Soundtrack playback needs a user gesture. Keep the scene and music at
    // zero together rather than silently autoplaying only the fireworks.
    if (audioUrl) {
      setPlayhead(0);
      setIsPlaying(false);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setPlayhead(hoverStartTimeRef.current);
      setIsPlaying(false);
      return;
    }
    setPlayhead(0);
    setIsPlaying(true);
  }, [audioUrl, isDetail, cues.length, setPlayhead]);

  useEffect(() => {
    if (isPlaying) return;
    audioRef.current?.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (!active || cues.length === 0) return;
    let frame = 0;
    startedAt.current = performance.now();
    playheadStart.current = elapsedRef.current >= duration ? 0 : elapsedRef.current;

    function tick(now: number) {
      if (startedAt.current == null) return;
      const audio = audioRef.current;
      const audioTime =
        audio && !audio.paused && !audio.ended && Number.isFinite(audio.currentTime)
          ? audio.currentTime
          : null;
      const next =
        audioTime ?? playheadStart.current + ((now - startedAt.current) / 1000) * playbackRate;
      if (audioTime != null) {
        startedAt.current = now;
        playheadStart.current = next;
      }
      if (next >= duration) {
        if (isDetail) {
          audio?.pause();
          elapsedRef.current = duration;
          setDisplayElapsed(duration);
          setElapsed(duration);
          setIsPlaying(false);
          return;
        }
        startedAt.current = now;
        playheadStart.current = 0;
        elapsedRef.current = 0;
        setElapsed(0);
      } else {
        elapsedRef.current = next;
        // The transport thumb self-animates from elapsedRef; React state only
        // needs the ~15Hz active-cue cadence, not a re-render per frame.
        if (isDetail && next - lastUIElapsedRef.current >= 0.067) {
          lastUIElapsedRef.current = next;
          setDisplayElapsed(next);
        }
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, cues.length, duration, isDetail, playbackRate]);

  function scrubTo(seconds: number) {
    const next = Math.max(0, Math.min(duration, seconds));
    elapsedRef.current = next;
    pendingScrubRef.current = next;
    setIsScrubbing(true);
    const now = performance.now();
    if (now - lastScrubCommitRef.current >= SCRUB_COMMIT_INTERVAL_MS) {
      lastScrubCommitRef.current = now;
      lastUIElapsedRef.current = next;
      setDisplayElapsed(next);
      setElapsed(next);
    }
  }

  function commitScrub() {
    setIsScrubbing(false);
    const pending = pendingScrubRef.current;
    if (pending == null) return;
    pendingScrubRef.current = null;
    lastScrubCommitRef.current = 0;
    setPlayhead(pending);
    if (audioRef.current) audioRef.current.currentTime = pending;
  }

  function togglePlayback() {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (elapsedRef.current >= duration) {
      setPlayhead(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    }
    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(true);
      return;
    }
    audio.currentTime = elapsedRef.current;
    void audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }

  function restart() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setPlayhead(0);
  }

  const shouldMountCanvas =
    isDetail ||
    (lazyHoverMount
      ? cardPlaybackActive || keepCardCanvasMounted
      : isVisible || cardPlaybackActive);

  return (
    <div
      ref={containerRef}
      {...fullscreenContainerProps}
      className={cn(
        isDetail
          ? detailAppearance === 'borderless'
            ? 'group/replay isolate overflow-hidden rounded-3xl bg-black shadow-[var(--shadow-card-hover)]'
            : 'group/replay border-border overflow-hidden rounded-2xl border bg-black shadow-[var(--shadow-card-hover)]'
          : (cardClassName ?? 'relative h-44 overflow-hidden'),
        isDetail &&
          (isFullscreen
            ? 'fixed inset-[5vmin] z-[100] shadow-[var(--shadow-modal)]'
            : 'relative h-[min(72vh,680px)] min-h-[520px]'),
      )}
      style={isDetail || lazyHoverMount ? undefined : { backgroundImage: 'var(--preview-card-bg)' }}
    >
      <div
        className={
          isDetail ? 'relative h-full w-full overflow-hidden rounded-[inherit]' : 'relative h-full'
        }
      >
        {shouldMountCanvas ? (
          <MemoizedFireworkReplayCanvas
            cues={cues}
            elapsed={elapsed}
            playbackRef={elapsedRef}
            scrubbing={isScrubbing}
            interactive={isDetail}
            muted={isDetail ? !isPlaying : true}
            maxDevicePixelRatio={2}
            antialias
            primeSnapshots={isDetail}
            loadingBarPosition="bottom"
            showLoadingBar={isDetail}
            onReady={handleReplayReady}
          />
        ) : lazyHoverMount ? null : (
          <ReplayCanvasSkeleton />
        )}
      </div>
      {isDetail ? (
        <>
          {audioUrl ? (
            <audio
              ref={audioRef}
              preload="auto"
              src={audioUrl}
              onPause={() => setIsPlaying(false)}
              onError={() => setIsPlaying(false)}
              onEnded={() => {
                setPlayhead(duration);
                setIsPlaying(false);
              }}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          {isReplayReady ? (
            <div className="absolute inset-x-0 bottom-6 z-20">
              <ReplayTransportControls
                elapsed={displayElapsed}
                playheadRef={elapsedRef}
                duration={duration}
                isPlaying={isPlaying}
                disabled={cues.length === 0}
                fullscreen={isFullscreen}
                playLabel="Play template preview"
                pauseLabel="Pause template preview"
                resetLabel="Restart template preview"
                timelineLabel="Template preview timeline"
                onPlayPause={togglePlayback}
                onReset={restart}
                onFullscreenToggle={toggleFullscreen}
                onScrub={(next) => {
                  setIsPlaying(false);
                  scrubTo(next);
                }}
                onScrubEnd={commitScrub}
              />
            </div>
          ) : null}
          {isFullscreen ? <PreviewFullscreenBackdrop onExit={exitFullscreen} /> : null}
        </>
      ) : !showCardOverlays ? null : (
        <>
          <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 text-right text-xs text-white shadow-sm backdrop-blur transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-0 group-focus-visible:-translate-y-1 group-focus-visible:opacity-0">
            <span className="inline-flex items-center justify-end gap-1">
              <Heart size={14} className="fill-current text-[color:var(--destructive)]" />
              <span className="tabular-nums">{template.likeCount}</span>
            </span>
            <span
              className="block font-mono tabular-nums"
              title="Estimated retail cost of fireworks"
            >
              {formatBudget(template.totalCents)}
            </span>
          </div>
          <div
            className={
              isCardHovered
                ? 'pointer-events-none absolute inset-x-0 bottom-0 h-[15%] translate-y-full bg-[linear-gradient(90deg,var(--template-accent-start),var(--template-accent-middle),var(--template-accent-end))] [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.5)_28%,transparent_72%)] opacity-0 transition-all duration-[1800ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none'
                : 'pointer-events-none absolute inset-x-0 bottom-0 h-[15%] translate-y-0 bg-[linear-gradient(90deg,var(--template-accent-start),var(--template-accent-middle),var(--template-accent-end))] [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.5)_28%,transparent_72%)] opacity-70 transition-all duration-500 ease-in-out motion-reduce:transition-none'
            }
          />
        </>
      )}
    </div>
  );
}
