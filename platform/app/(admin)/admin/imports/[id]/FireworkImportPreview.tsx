'use client';

/** Client preview of frames and products extracted by an import job. */

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PreviewFullscreenBackdrop,
  usePreviewFullscreen,
} from '@/app/components/admin/previewFullscreen';
import { ReplayLoadingBar } from '@/app/components/app/ReplayLoadingBar';
import { ReplayTransportControls } from '@/app/components/app/ReplayTransportControls';
import { importedSpecToReplayCues, type ImportedFireworkSpec } from '@/lib/import-jobs';
import { cn } from '@/lib/utils';

type FireworkImportPreviewProps = {
  videoUrl: string | null;
  /** Helps the browser choose a decoder when the manifest is ambiguous. */
  videoMimeType?: string | null;
  spec: ImportedFireworkSpec | null;
  fallbackDuration: number;
};

function ReplayCanvasSkeleton() {
  return (
    <div className="absolute inset-0 h-full w-full animate-pulse overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(180deg,#05070d,#101522)]">
      <ReplayLoadingBar progress={null} position="bottom" />
    </div>
  );
}

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <ReplayCanvasSkeleton />,
  },
);

export function FireworkImportPreview({
  videoUrl,
  videoMimeType,
  spec,
  fallbackDuration,
}: FireworkImportPreviewProps) {
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const cues = useMemo(() => (spec ? importedSpecToReplayCues(spec) : []), [spec]);

  const canControlPlayback = Boolean(videoUrl || spec);
  const [videoMetaDuration, setVideoMetaDuration] = useState<number | null>(null);
  const [videoDecodeError, setVideoDecodeError] = useState<string | null>(null);
  const timelineDuration = Math.max(
    1,
    videoMetaDuration ?? 0,
    spec?.durationSeconds ?? 0,
    fallbackDuration,
  );

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const elapsedRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
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
    void video.play().catch(() => setPlaying(false));
  }, [playing, videoUrl]);

  // Single animation clock: RAF samples the video timeline when source video exists,
  // otherwise steps elapsed internally. Avoids rewriting video.currentTime every frame.
  useEffect(() => {
    if (!playing) return;

    let rafId = 0;
    const begunAt = performance.now();
    const startElapsed = elapsedRef.current;

    const tick = (now: number) => {
      if (!playingRef.current) return;

      const video = videoRef.current;
      if (videoUrl) {
        if (!video) {
          rafId = requestAnimationFrame(tick);
          return;
        }
        if (video.ended) {
          setPlaying(false);
          setElapsed(timelineDuration);
          return;
        }
        setElapsed(Math.min(video.currentTime, timelineDuration));
        rafId = requestAnimationFrame(tick);
        return;
      }

      const next = Math.min(timelineDuration, startElapsed + (now - begunAt) / 1000);
      setElapsed(next);
      if (next >= timelineDuration) {
        setPlaying(false);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, videoUrl, timelineDuration]);

  function seek(next: number) {
    const clamped = Math.min(timelineDuration, Math.max(0, next));
    setElapsed(clamped);

    const video = videoRef.current;
    if (video && videoUrl) {
      try {
        videoSyncFromUiRef.current = true;
        video.currentTime = clamped;
        requestAnimationFrame(() => {
          videoSyncFromUiRef.current = false;
        });
      } catch {
        videoSyncFromUiRef.current = false;
      }
    }
  }

  function restart() {
    setPlaying(false);
    seek(0);
    if (videoRef.current && videoUrl) {
      videoRef.current.pause();
    }
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
          'Playback has sound but no picture: this file’s video track is not decodable here (often HEVC/H.265, e.g. from iPhones). Export as H.264 (AVC) + AAC in an MP4 and upload again.',
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
          video.currentTime = elapsedRef.current;
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

    setPlaying(true);
  }

  return (
    <div
      className={cn(
        'space-y-4',
        isFullscreen &&
          'fixed inset-[5vmin] z-[100] overflow-auto rounded-2xl border border-white/12 bg-black p-4 shadow-[var(--shadow-modal)]',
      )}
    >
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <div className="border-outline-variant/35 relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
          {videoUrl ? (
            <>
              <video
                key={videoUrl}
                ref={videoRef}
                tabIndex={-1}
                playsInline
                preload="auto"
                className="pointer-events-none absolute inset-0 z-10 h-full w-full bg-black object-contain outline-none"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
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
                    'This browser could not load the uploaded file. Prefer H.264 in an MP4 container, or verify storage signing (SUPABASE_SERVICE_ROLE_KEY on the Next server).',
                  )
                }
                onEnded={() => {
                  setPlaying(false);
                  const v = videoRef.current;
                  if (v && Number.isFinite(v.duration))
                    setElapsed(Math.min(v.currentTime, timelineDuration));
                }}
              >
                <source
                  src={videoUrl}
                  type={videoMimeType && videoMimeType.length > 0 ? videoMimeType : 'video/mp4'}
                />
              </video>
              {/* Transparent layer: eats pointer/double-click so the picture never toggles playback; emits no audio. */}
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
                <div className="text-on-error pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 text-center text-xs leading-relaxed">
                  {videoDecodeError}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-on-surface-variant flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm">
              No source video is available for this import.
            </div>
          )}
        </div>
        <div className="border-outline-variant/35 bg-surface-container-lowest relative aspect-video w-full overflow-hidden rounded-xl border">
          <div className="absolute inset-0 min-h-[200px]">
            {spec ? (
              <LazyFireworkReplayCanvas
                cues={cues}
                elapsed={elapsed}
                interactive
                showFps
                primeSnapshots
                showLoadingBar
                loadingBarPosition="bottom"
              />
            ) : (
              <div className="text-on-surface-variant flex h-full items-center justify-center p-6 text-center text-sm">
                The generated 3D reconstruction will appear after processing.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-outline-variant/25 bg-surface-container-low rounded-xl border p-4">
        <ReplayTransportControls
          elapsed={elapsed}
          duration={timelineDuration}
          isPlaying={playing}
          disabled={!canControlPlayback}
          step={0.02}
          playLabel="Play comparison preview"
          pauseLabel="Pause comparison preview"
          resetLabel="Restart comparison preview"
          timelineLabel="Synced source and generated preview timeline"
          fullscreen={isFullscreen}
          onPlayPause={togglePlayback}
          onReset={restart}
          onFullscreenToggle={toggleFullscreen}
          onScrub={(next) => {
            setPlaying(false);
            videoRef.current?.pause();
            seek(next);
          }}
        />
      </div>
      {isFullscreen ? <PreviewFullscreenBackdrop onExit={exitFullscreen} /> : null}
    </div>
  );
}
