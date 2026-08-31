'use client';

/** Client preview of frames and products extracted by an import job. */

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PreviewFullscreenBackdrop,
  usePreviewFullscreen,
} from '@/components/admin/previewFullscreen';
import { ReplayLoadingBar } from '@/components/replay/ReplayLoadingBar';
import { ReplayTransportControls } from '@/components/replay/ReplayTransportControls';
import { importedSpecToReplayCues, type ImportedFireworkSpec } from '@/lib/import-jobs';
import {
  reconstructionToReplayCues,
  type ImportReconstructionPlan,
} from '@/lib/import-reconstruction';
import { cn } from '@/lib/utils';

type FireworkImportPreviewProps = {
  videoUrl: string | null;
  /** Helps the browser choose a decoder when the manifest is ambiguous. */
  videoMimeType?: string | null;
  /** Immutable sampled renderer frames retained with the selected candidate. */
  retainedEvidenceUrl?: string | null;
  spec: ImportedFireworkSpec | null;
  reconstruction?: ImportReconstructionPlan | null;
  fallbackDuration: number;
};

function ReplayCanvasSkeleton() {
  return (
    <div className="absolute inset-0 h-full w-full animate-pulse overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(180deg,#05070d,#101522)] motion-reduce:animate-none">
      <ReplayLoadingBar progress={null} position="bottom" />
    </div>
  );
}

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/components/replay/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <ReplayCanvasSkeleton />,
  },
);

export function FireworkImportPreview({
  videoUrl,
  videoMimeType,
  retainedEvidenceUrl,
  spec,
  reconstruction,
  fallbackDuration,
}: FireworkImportPreviewProps) {
  const {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
    fullscreenContainerRef,
    fullscreenContainerProps,
  } = usePreviewFullscreen({ dialogLabel: 'Import source and engine evidence preview' });
  const cues = useMemo(
    () =>
      reconstruction
        ? reconstructionToReplayCues(reconstruction, { idPrefix: 'import-review' })
        : spec
          ? importedSpecToReplayCues(spec)
          : [],
    [reconstruction, spec],
  );

  const canControlPlayback = Boolean(videoUrl || retainedEvidenceUrl || reconstruction || spec);
  const [videoMetaDuration, setVideoMetaDuration] = useState<number | null>(null);
  const [retainedEvidenceDuration, setRetainedEvidenceDuration] = useState<number | null>(null);
  const [videoDecodeError, setVideoDecodeError] = useState<string | null>(null);
  const [retainedEvidenceError, setRetainedEvidenceError] = useState<string | null>(null);
  const timelineDuration = Math.max(
    1,
    videoMetaDuration ?? 0,
    retainedEvidenceDuration ?? 0,
    reconstruction?.durationSeconds ?? 0,
    spec?.durationSeconds ?? 0,
    fallbackDuration,
  );

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const elapsedRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const retainedEvidenceRef = useRef<HTMLVideoElement>(null);
  /** True while syncing source video so timeupdate callbacks do not overwrite slider seeks. */
  const videoSyncFromUiRef = useRef(false);
  const timelineDurationRef = useRef(timelineDuration);
  const probeGenerationRef = useRef(0);

  useEffect(() => {
    timelineDurationRef.current = timelineDuration;
  }, [timelineDuration]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    probeGenerationRef.current += 1;
    setVideoDecodeError(null);
  }, [videoUrl]);

  useEffect(() => {
    setRetainedEvidenceDuration(null);
    setRetainedEvidenceError(null);
  }, [retainedEvidenceUrl]);

  // Keep source audio unmuted and at full level; controls are the bar below (no native media UI).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.muted = false;
    video.volume = 1;
  }, [videoUrl, playing]);

  // Drive / pause HTML video from shared play state only (avoid onPlay/onPause feedback loops).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    if (!playing) {
      video.pause();
      return;
    }
    if (Number.isFinite(video.duration) && elapsedRef.current >= video.duration) {
      video.pause();
      return;
    }
    void video.play().catch(() => setPlaying(false));
  }, [playing, videoUrl]);

  // The retained MP4 has no authoritative audio and follows the shared
  // inspection playhead. Its held frames remain visibly distinct from the
  // continuously rendered current-engine reconstruction.
  useEffect(() => {
    const video = retainedEvidenceRef.current;
    if (!video || !retainedEvidenceUrl) return;
    video.muted = true;
    if (!playing) {
      video.pause();
      return;
    }
    if (Number.isFinite(video.duration) && elapsedRef.current >= video.duration) {
      video.pause();
      return;
    }
    void video.play().catch(() => {
      setRetainedEvidenceError(
        'The retained sampled evidence could not be played in this browser.',
      );
    });
  }, [playing, retainedEvidenceUrl]);

  // A single wall clock keeps reconstruction playback moving if the source
  // video ends before a longer inferred fade. While video is active, its
  // timestamp remains the authoritative clock to prevent audible drift.
  useEffect(() => {
    if (!playing) return;

    let rafId = 0;
    const begunAt = performance.now();
    const startElapsed = elapsedRef.current;

    const tick = (now: number) => {
      if (!playingRef.current) return;

      const video = videoRef.current;
      const retainedEvidence = retainedEvidenceRef.current;
      const wallClock = startElapsed + (now - begunAt) / 1000;
      const videoIsAuthoritative =
        Boolean(videoUrl) &&
        video !== null &&
        !video.ended &&
        Number.isFinite(video.duration) &&
        wallClock <= video.duration + 0.08;
      const retainedEvidenceIsAuthoritative =
        !videoIsAuthoritative &&
        !videoUrl &&
        Boolean(retainedEvidenceUrl) &&
        retainedEvidence !== null &&
        !retainedEvidence.ended &&
        Number.isFinite(retainedEvidence.duration) &&
        wallClock <= retainedEvidence.duration + 0.08;
      const next = Math.min(
        timelineDuration,
        videoIsAuthoritative && video
          ? video.currentTime
          : retainedEvidenceIsAuthoritative && retainedEvidence
            ? retainedEvidence.currentTime
            : wallClock,
      );
      setElapsed(next);
      if (next >= timelineDuration) {
        setPlaying(false);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, retainedEvidenceUrl, videoUrl, timelineDuration]);

  function seek(next: number) {
    const clamped = Math.min(timelineDuration, Math.max(0, next));
    setElapsed(clamped);

    const video = videoRef.current;
    if (video && videoUrl) {
      try {
        videoSyncFromUiRef.current = true;
        video.currentTime = Number.isFinite(video.duration)
          ? Math.min(clamped, video.duration)
          : clamped;
        requestAnimationFrame(() => {
          videoSyncFromUiRef.current = false;
        });
      } catch {
        videoSyncFromUiRef.current = false;
      }
    }

    const retainedEvidence = retainedEvidenceRef.current;
    if (retainedEvidence && retainedEvidenceUrl) {
      try {
        retainedEvidence.currentTime = Number.isFinite(retainedEvidence.duration)
          ? Math.min(clamped, retainedEvidence.duration)
          : clamped;
      } catch {
        setRetainedEvidenceError(
          'The retained sampled evidence could not be aligned to this timestamp.',
        );
      }
    }
  }

  function restart() {
    setPlaying(false);
    seek(0);
    if (videoRef.current && videoUrl) {
      videoRef.current.pause();
    }
    retainedEvidenceRef.current?.pause();
  }

  function probeVideoRenderable(video: HTMLVideoElement) {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    const gen = ++probeGenerationRef.current;

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setVideoDecodeError(null);
      return;
    }

    window.requestAnimationFrame(() => {
      if (gen !== probeGenerationRef.current) return;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoDecodeError(null);
        return;
      }

      window.setTimeout(() => {
        if (gen !== probeGenerationRef.current) return;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setVideoDecodeError(null);
          return;
        }
        setVideoDecodeError(
          "Playback has sound but no picture. This file's video track is not decodable here, often because it uses HEVC/H.265. Export it as H.264 with AAC in an MP4 and upload again.",
        );
      }, 550);
    });
  }

  function togglePlayback() {
    if (!canControlPlayback) return;

    const atEnd = elapsed >= timelineDuration - 1 / 120;
    const video = videoRef.current;

    if (playing) {
      setPlaying(false);
      video?.pause();
      retainedEvidenceRef.current?.pause();
      return;
    }

    // Align video once when restarting play so clocks match.
    if (videoUrl && video && Number.isFinite(video.duration)) {
      try {
        if (atEnd) {
          video.currentTime = 0;
          setElapsed(0);
        } else if (Math.abs(video.currentTime - elapsed) > 0.08) {
          videoSyncFromUiRef.current = true;
          video.currentTime = Math.min(elapsedRef.current, video.duration);
          requestAnimationFrame(() => {
            videoSyncFromUiRef.current = false;
          });
        }
      } catch {
        videoSyncFromUiRef.current = false;
      }
    } else if (atEnd) {
      setElapsed(0);
    }

    const retainedEvidence = retainedEvidenceRef.current;
    if (retainedEvidenceUrl && retainedEvidence && Number.isFinite(retainedEvidence.duration)) {
      try {
        retainedEvidence.currentTime = atEnd
          ? 0
          : Math.min(elapsedRef.current, retainedEvidence.duration);
      } catch {
        setRetainedEvidenceError(
          'The retained sampled evidence could not be aligned to this timestamp.',
        );
      }
    }

    setPlaying(true);
  }

  return (
    <div
      ref={fullscreenContainerRef}
      {...fullscreenContainerProps}
      className={cn(
        'space-y-4',
        isFullscreen &&
          'fixed inset-[5vmin] z-[100] overflow-auto rounded-2xl border border-white/12 bg-black p-4 shadow-[var(--shadow-modal)]',
      )}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section aria-labelledby="source-video-heading" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 id="source-video-heading" className="text-foreground text-sm font-medium">
              Source video
            </h3>
            {videoMetaDuration != null ? (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {videoMetaDuration.toFixed(2)}s
              </span>
            ) : null}
          </div>
          <div className="border-border relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
            {videoUrl ? (
              <>
                <video
                  key={videoUrl}
                  ref={videoRef}
                  tabIndex={-1}
                  playsInline
                  preload="auto"
                  className="pointer-events-none absolute inset-0 z-10 h-full w-full bg-black object-contain outline-none"
                  onLoadedData={(event) => {
                    const v = event.currentTarget;
                    v.volume = 1;
                    v.muted = false;
                    probeVideoRenderable(v);
                  }}
                  onLoadedMetadata={(event) => {
                    const v = event.currentTarget;
                    v.volume = 1;
                    v.muted = false;
                    const dur = v.duration;
                    if (Number.isFinite(dur) && dur > 0) setVideoMetaDuration(dur);
                    probeVideoRenderable(v);
                  }}
                  onTimeUpdate={(event) => {
                    if (videoSyncFromUiRef.current) return;
                    const v = event.currentTarget;
                    setElapsed(Math.min(v.currentTime, timelineDurationRef.current));
                  }}
                  onError={() =>
                    setVideoDecodeError(
                      'This browser could not play the uploaded file. Try an H.264 video with AAC audio in an MP4 container.',
                    )
                  }
                  onEnded={() => {
                    const v = videoRef.current;
                    if (v && Number.isFinite(v.duration) && timelineDuration <= v.duration + 0.08) {
                      setPlaying(false);
                      setElapsed(Math.min(v.currentTime, timelineDuration));
                    }
                  }}
                  aria-label="Uploaded source video"
                >
                  <source
                    src={videoUrl}
                    type={videoMimeType && videoMimeType.length > 0 ? videoMimeType : 'video/mp4'}
                  />
                </video>
                {/* Playback is controlled by the shared transport below. */}
                <div
                  className="absolute inset-0 z-[15] cursor-default touch-none bg-transparent select-none"
                  aria-hidden="true"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                />
                {videoDecodeError ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 text-center text-xs leading-relaxed text-white"
                    role="alert"
                  >
                    {videoDecodeError}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-muted-foreground flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm">
                No source video is available for this import.
              </div>
            )}
          </div>
        </section>
        <section aria-labelledby="retained-evidence-heading" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 id="retained-evidence-heading" className="text-foreground text-sm font-medium">
              Retained sampled engine evidence
            </h3>
            {retainedEvidenceDuration != null ? (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {retainedEvidenceDuration.toFixed(2)}s
              </span>
            ) : null}
          </div>
          <div className="border-border relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
            {retainedEvidenceUrl ? (
              <>
                <video
                  key={retainedEvidenceUrl}
                  ref={retainedEvidenceRef}
                  tabIndex={-1}
                  playsInline
                  muted
                  preload="metadata"
                  className="pointer-events-none absolute inset-0 h-full w-full bg-black object-contain outline-none"
                  onLoadedMetadata={(event) => {
                    const retainedVideo = event.currentTarget;
                    retainedVideo.muted = true;
                    const duration = retainedVideo.duration;
                    if (Number.isFinite(duration) && duration > 0) {
                      setRetainedEvidenceDuration(duration);
                    }
                  }}
                  onError={() =>
                    setRetainedEvidenceError(
                      'The retained sampled evidence could not be loaded. Refresh this audit page to renew its private link.',
                    )
                  }
                  aria-label="Retained sampled engine evidence"
                >
                  <source src={retainedEvidenceUrl} type="video/mp4" />
                </video>
                {retainedEvidenceError ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4 text-center text-xs leading-relaxed text-white"
                    role="status"
                  >
                    {retainedEvidenceError}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-muted-foreground flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm">
                No retained sampled engine evidence is available for the selected candidate.
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Run-owned sampled frames captured during validation. This is an immutable audit
            artefact, not continuous footage or a claim of exact physical recovery.
          </p>
        </section>
        <section aria-labelledby="reconstruction-heading" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 id="reconstruction-heading" className="text-foreground text-sm font-medium">
              Live current-engine reconstruction
            </h3>
            {reconstruction ? (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {reconstruction.shots.length} {reconstruction.shots.length === 1 ? 'shot' : 'shots'}
              </span>
            ) : null}
          </div>
          <div className="border-border bg-muted relative aspect-video w-full overflow-hidden rounded-lg border">
            <div className="absolute inset-0 min-h-[200px]">
              {reconstruction || spec ? (
                <LazyFireworkReplayCanvas
                  cues={cues}
                  elapsed={elapsed}
                  interactive
                  showFps={false}
                  primeSnapshots
                  showLoadingBar
                  loadingBarPosition="bottom"
                />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm">
                  The generated 3D reconstruction will appear after processing.
                </div>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Re-rendered now from the selected reconstruction. It may differ from retained evidence
            after a renderer contract change.
          </p>
        </section>
      </div>

      <div className="border-border bg-muted/40 rounded-lg border p-4">
        <ReplayTransportControls
          elapsed={elapsed}
          duration={timelineDuration}
          isPlaying={playing}
          disabled={!canControlPlayback}
          step={0.02}
          playLabel="Play source and engine evidence"
          pauseLabel="Pause source and engine evidence"
          resetLabel="Restart source and engine evidence"
          timelineLabel="Synced source, retained evidence and live reconstruction timeline"
          fullscreen={isFullscreen}
          onPlayPause={togglePlayback}
          onReset={restart}
          onFullscreenToggle={toggleFullscreen}
          onScrub={(next) => {
            setPlaying(false);
            videoRef.current?.pause();
            retainedEvidenceRef.current?.pause();
            seek(next);
          }}
        />
      </div>
      {isFullscreen ? <PreviewFullscreenBackdrop onExit={exitFullscreen} /> : null}
    </div>
  );
}
