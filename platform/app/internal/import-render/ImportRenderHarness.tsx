'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FireworkReplayCaptureController,
  FireworkReplayCapturedFrame,
} from '@/app/components/app/FireworkReplayCanvas';
import {
  analyseImportRenderPixels,
  buildImportTemporalForegroundFrames,
  buildImportRenderMetrics,
  compareImportRenderPixels,
  type ImportRenderFrameFeatures,
  type ImportRenderPerceptualFrame,
} from '@/lib/import-render-metrics';
import { parseImportReconstruction, reconstructionToReplayCues } from '@/lib/import-reconstruction';
import { estimateDesignDurationSeconds, scaleDesignForCaliber } from '@/lib/fireworks/design';
import {
  FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
  quantiseFireworksEngineTimeSeconds,
} from '@/lib/fireworks/import-renderer-contract';
import type { ReplayCue } from '@/lib/show-domain';

const FireworkReplayCanvas = dynamic(
  () =>
    import('@/app/components/app/FireworkReplayCanvas').then(
      (module) => module.FireworkReplayCanvas,
    ),
  { ssr: false },
);

const HARNESS_VERSION = 'showcrafter.import-render-harness.v1' as const;
const RESULT_VERSION = 'showcrafter.import-render-result.v1' as const;
const MAX_CAPTURE_FRAMES = 180;
const MAX_SOURCE_BYTES = 250 * 1024 * 1024;
const DEFAULT_RENDER_EDGE = 960;
const MIN_RENDER_EDGE = 320;
const MAX_RENDER_EDGE = 1280;
const ANALYSIS_EDGE = 256;
const MAX_EXPORTED_FRAME_COUNT = 48;
const MAX_EXPORTED_FRAME_BYTES = 16 * 1024 * 1024;
const SOURCE_LOAD_TIMEOUT_MS = 20_000;
const SOURCE_SEEK_TIMEOUT_MS = 10_000;
const ENGINE_READY_TIMEOUT_MS = 60_000;
const RENDER_SESSION_TIMEOUT_MS = 5 * 60_000;

type HarnessPhase =
  | 'awaiting-source'
  | 'loading-source'
  | 'loading-engine'
  | 'ready'
  | 'rendering'
  | 'complete'
  | 'error';

export type ImportRenderHarnessRequest = {
  reconstruction: unknown;
  timestampsSeconds: number[];
  includeRenderedFrames?: boolean;
  maxRenderEdge?: number;
};

export type ImportRenderHarnessResult = {
  schemaVersion: typeof RESULT_VERSION;
  harnessVersion: typeof HARNESS_VERSION;
  rendererVersion: typeof FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION;
  source: {
    durationSeconds: number;
    width: number;
    height: number;
  };
  rendererDurations: Array<{ designKey: string; durationSeconds: number }>;
  requiredProductDurationSeconds: number;
  metrics: ReturnType<typeof buildImportRenderMetrics>;
  renderedFrames: Array<{
    timeSeconds: number;
    pngBase64: string | null;
    stats: FireworkReplayCapturedFrame['stats'];
  }>;
};

type HarnessApi = {
  version: typeof HARNESS_VERSION;
  status(): { phase: HarnessPhase; renderedFrames: number; error: string | null };
  renderCandidate(request: ImportRenderHarnessRequest): Promise<ImportRenderHarnessResult>;
};

declare global {
  interface Window {
    __SHOWCRAFTER_IMPORT_RENDER__?: HarnessApi;
  }
}

type RenderSession = {
  generation: number;
  width: number;
  height: number;
  cues: ReplayCue[];
};

type ReadyWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};

function emitHarnessEvent(detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent('showcrafter:import-render', { detail }));
}

function once(
  target: EventTarget,
  event: string,
  errorEvent = 'error',
  timeoutMs = SOURCE_LOAD_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      target.removeEventListener(event, onSuccess);
      target.removeEventListener(errorEvent, onError);
    };
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Source video emitted '${errorEvent}' before '${event}'.`));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(`Source video did not emit '${event}' within ${timeoutMs / 1_000} seconds.`),
      );
    }, timeoutMs);
    target.addEventListener(event, onSuccess, { once: true });
    target.addEventListener(errorEvent, onError, { once: true });
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function loadSourceVideo(
  file: File,
): Promise<{ video: HTMLVideoElement; objectUrl: string }> {
  if (file.size < 1 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Source video must be between 1 byte and 250 MB.');
  }
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;
  video.load();
  try {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) await once(video, 'loadedmetadata');
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await once(video, 'loadeddata');
    if (
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.duration > 60.05 ||
      video.videoWidth < 1 ||
      video.videoHeight < 1
    ) {
      throw new Error('Source video metadata is outside the import limits.');
    }
    return { video, objectUrl };
  } catch (error) {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function seekSourceVideo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  const target = Math.min(Math.max(0, timeSeconds), Math.max(0, video.duration - 0.001));
  if (Math.abs(video.currentTime - target) < 0.0005 && video.readyState >= 2) return;
  const seeked = once(video, 'seeked', 'error', SOURCE_SEEK_TIMEOUT_MS);
  video.currentTime = target;
  await seeked;
}

function boundedRenderSize(sourceWidth: number, sourceHeight: number, requestedEdge?: number) {
  const edge = Math.round(
    Math.min(MAX_RENDER_EDGE, Math.max(MIN_RENDER_EDGE, requestedEdge ?? DEFAULT_RENDER_EDGE)),
  );
  const scale = Math.min(1, edge / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function boundedTimestamps(values: number[], durationSeconds: number): number[] {
  if (!Array.isArray(values) || values.length < 2 || values.length > MAX_CAPTURE_FRAMES) {
    throw new Error(`Between 2 and ${MAX_CAPTURE_FRAMES} source timestamps are required.`);
  }
  const unique = new Map<string, number>();
  values.forEach((value) => {
    if (!Number.isFinite(value) || value < 0 || value > durationSeconds + 0.01) {
      throw new Error('Every source timestamp must fall inside the source video.');
    }
    const bounded = Math.min(value, durationSeconds);
    const nearest = quantiseFireworksEngineTimeSeconds(bounded);
    const timestamp =
      nearest <= durationSeconds + 0.0001
        ? nearest
        : quantiseFireworksEngineTimeSeconds(durationSeconds, 'floor');
    unique.set(timestamp.toFixed(6), timestamp);
  });
  const timestamps = [...unique.values()].sort((left, right) => left - right);
  if (timestamps.length < 2) throw new Error('At least two unique source timestamps are required.');
  return timestamps;
}

function appendRendererTailTimestamps(values: number[], requiredDurationSeconds: number): number[] {
  const latestTimestamp = values.at(-1)!;
  const requiredBoundary = quantiseFireworksEngineTimeSeconds(requiredDurationSeconds, 'ceil');
  if (requiredBoundary <= latestTimestamp + 0.0001) return values;
  const availableSlots = MAX_CAPTURE_FRAMES - values.length;
  if (availableSlots < 1) {
    throw new Error('Leave at least one capture slot for the renderer lifetime boundary.');
  }
  const desiredTailFrames = Math.max(1, Math.ceil((requiredBoundary - latestTimestamp) / 0.25));
  const tailFrames = Math.min(availableSlots, desiredTailFrames);
  return [
    ...values,
    ...Array.from({ length: tailFrames }, (_, index) => {
      const progress = (index + 1) / tailFrames;
      return quantiseFireworksEngineTimeSeconds(
        latestTimestamp + (requiredBoundary - latestTimestamp) * progress,
      );
    }),
  ];
}

function pixelsAtAnalysisSize(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): { pixels: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, ANALYSIS_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The browser could not create a 2D comparison context.');
  context.drawImage(source, 0, 0, width, height);
  return { pixels: context.getImageData(0, 0, width, height).data, width, height };
}

function emptyAnalysisPixels(sourceWidth: number, sourceHeight: number) {
  const scale = Math.min(1, ANALYSIS_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 3; offset < pixels.length; offset += 4) pixels[offset] = 255;
  return { pixels, width, height };
}

function capturedFrameCanvas(frame: FireworkReplayCapturedFrame): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The browser could not copy the engine frame.');
  const pixels = new Uint8ClampedArray(frame.pixels.length);
  pixels.set(frame.pixels);
  context.putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0);
  return canvas;
}

export function ImportRenderHarness() {
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const playbackRef = useRef(0);
  const controllerRef = useRef<FireworkReplayCaptureController | null>(null);
  const readyWaiterRef = useRef<ReadyWaiter | null>(null);
  const phaseRef = useRef<HarnessPhase>('awaiting-source');
  const renderedFrameCountRef = useRef(0);
  const errorRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const [session, setSession] = useState<RenderSession | null>(null);

  const setPhase = useCallback((phase: HarnessPhase, error: string | null = null) => {
    phaseRef.current = phase;
    errorRef.current = error;
  }, []);

  const onController = useCallback((controller: FireworkReplayCaptureController | null) => {
    controllerRef.current = controller;
  }, []);

  const onEngineReady = useCallback(() => {
    if (!controllerRef.current) {
      const error = new Error('FireworksEngine became ready without a capture controller.');
      readyWaiterRef.current?.reject(error);
      readyWaiterRef.current = null;
      return;
    }
    setPhase('ready');
    emitHarnessEvent({ type: 'engine-ready', harnessVersion: HARNESS_VERSION });
    readyWaiterRef.current?.resolve();
    readyWaiterRef.current = null;
  }, [setPhase]);

  const renderCandidate = useCallback(
    async (request: ImportRenderHarnessRequest): Promise<ImportRenderHarnessResult> => {
      if (runningRef.current)
        throw new Error('The render harness is already processing a candidate.');
      runningRef.current = true;
      renderedFrameCountRef.current = 0;
      setPhase('loading-source');
      let sourceObjectUrl: string | null = null;
      let sourceVideo: HTMLVideoElement | null = null;
      let engineCanvas: HTMLCanvasElement | null = null;
      let contextLossError: Error | null = null;
      const onContextLost = (event: Event) => {
        event.preventDefault();
        contextLossError = new Error('The FireworksEngine WebGL context was lost during capture.');
      };
      const deadline = performance.now() + RENDER_SESSION_TIMEOUT_MS;
      try {
        const parsed = parseImportReconstruction(request.reconstruction);
        if (!parsed.success) {
          const first = parsed.issues[0];
          throw new Error(
            first
              ? `Reconstruction is invalid at ${first.path.join('.') || 'root'}: ${first.message}`
              : 'Reconstruction is invalid.',
          );
        }
        const sourceFile = sourceInputRef.current?.files?.[0];
        if (!sourceFile) {
          throw new Error('Attach the browser-normalised source video before rendering.');
        }
        const loaded = await loadSourceVideo(sourceFile);
        sourceVideo = loaded.video;
        sourceObjectUrl = loaded.objectUrl;
        const requestedTimestamps = boundedTimestamps(
          request.timestampsSeconds,
          sourceVideo.duration,
        );
        const renderSize = boundedRenderSize(
          sourceVideo.videoWidth,
          sourceVideo.videoHeight,
          request.maxRenderEdge,
        );
        const cues = reconstructionToReplayCues(parsed.data, { idPrefix: 'import-validation' });
        const rendererDurations = parsed.data.designs.map((entry) => {
          const shotPans = parsed.data.shots
            .filter((shot) => shot.designKey === entry.key)
            .map((shot) => shot.panDegrees);
          return {
            designKey: entry.key,
            durationSeconds: Math.max(
              ...shotPans.map((panDegrees) =>
                estimateDesignDurationSeconds(entry.design, panDegrees),
              ),
            ),
          };
        });
        const requiredProductDurationSeconds = cues.reduce((requiredDuration, cue) => {
          if (!cue.firework.renderDesign) return requiredDuration;
          const renderedDuration = estimateDesignDurationSeconds(
            scaleDesignForCaliber(cue.firework.renderDesign, cue.firework.caliber),
            cue.shotPanDegrees ?? 0,
          );
          return Math.max(requiredDuration, cue.timeSeconds + renderedDuration);
        }, 0);
        const timestamps = appendRendererTailTimestamps(
          requestedTimestamps,
          Math.max(sourceVideo.duration, requiredProductDurationSeconds),
        );
        const includeRenderedFrames = request.includeRenderedFrames === true;
        if (includeRenderedFrames && timestamps.length > MAX_EXPORTED_FRAME_COUNT) {
          throw new Error(
            `Review artefacts are limited to ${MAX_EXPORTED_FRAME_COUNT} frames. Run full sampling without PNG frames.`,
          );
        }
        playbackRef.current = 0;
        controllerRef.current = null;
        generationRef.current += 1;
        setPhase('loading-engine');
        const ready = new Promise<void>((resolve, reject) => {
          readyWaiterRef.current = { resolve, reject };
        });
        setSession({ generation: generationRef.current, ...renderSize, cues });
        await withTimeout(
          ready,
          ENGINE_READY_TIMEOUT_MS,
          'FireworksEngine did not become ready within 60 seconds.',
        );

        const controller = controllerRef.current as FireworkReplayCaptureController | null;
        if (!controller) throw new Error('FireworksEngine capture controller is unavailable.');
        engineCanvas = document.querySelector<HTMLCanvasElement>(
          '[data-import-render-harness] canvas',
        );
        if (!engineCanvas) throw new Error('FireworksEngine did not mount a WebGL canvas.');
        engineCanvas.addEventListener('webglcontextlost', onContextLost);
        controller.reset();
        setPhase('rendering');
        const sourceFeatures: ImportRenderFrameFeatures[] = [];
        const renderedFeatures: ImportRenderFrameFeatures[] = [];
        const perceptualFrames: ImportRenderPerceptualFrame[] = [];
        const sourcePixelFrames: Uint8ClampedArray[] = [];
        const renderedPixelFrames: Uint8ClampedArray[] = [];
        const renderedFrames: ImportRenderHarnessResult['renderedFrames'] = [];
        let capturedWidth = renderSize.width;
        let capturedHeight = renderSize.height;
        let analysisWidth = 0;
        let analysisHeight = 0;
        let exportedFrameBytes = 0;
        let realSourceFrameCount = 0;

        for (const timeSeconds of timestamps) {
          if (contextLossError) throw contextLossError;
          if (performance.now() > deadline) {
            throw new Error('Engine render validation exceeded its five-minute session limit.');
          }
          const sourcePixels =
            timeSeconds <= sourceVideo.duration + 0.001
              ? await (async () => {
                  await seekSourceVideo(sourceVideo, timeSeconds);
                  realSourceFrameCount += 1;
                  return pixelsAtAnalysisSize(
                    sourceVideo,
                    sourceVideo.videoWidth,
                    sourceVideo.videoHeight,
                  );
                })()
              : emptyAnalysisPixels(sourceVideo.videoWidth, sourceVideo.videoHeight);
          const captured = controller.captureAt(timeSeconds, { includePng: includeRenderedFrames });
          if (contextLossError) throw contextLossError;
          capturedWidth = captured.width;
          capturedHeight = captured.height;
          const renderedPixels = pixelsAtAnalysisSize(
            capturedFrameCanvas(captured),
            captured.width,
            captured.height,
          );
          if (
            sourcePixels.width !== renderedPixels.width ||
            sourcePixels.height !== renderedPixels.height
          ) {
            throw new Error('Source and rendered analysis frames have different dimensions.');
          }
          analysisWidth = sourcePixels.width;
          analysisHeight = sourcePixels.height;
          sourcePixelFrames.push(sourcePixels.pixels);
          renderedPixelFrames.push(renderedPixels.pixels);
          if (captured.pngBase64) {
            exportedFrameBytes += Math.ceil((captured.pngBase64.length * 3) / 4);
            if (exportedFrameBytes > MAX_EXPORTED_FRAME_BYTES) {
              throw new Error('The encoded review frame sequence exceeds the 16 MB limit.');
            }
          }
          renderedFrames.push({
            timeSeconds,
            pngBase64: captured.pngBase64,
            stats: captured.stats,
          });
          renderedFrameCountRef.current = renderedFrames.length;
          emitHarnessEvent({
            type: 'elapsed-rendered',
            elapsedSeconds: timeSeconds,
            renderedFrames: renderedFrames.length,
          });
        }

        const sourceForegroundReal = buildImportTemporalForegroundFrames(
          sourcePixelFrames.slice(0, realSourceFrameCount),
          analysisWidth,
          analysisHeight,
          { registerTranslation: true },
        );
        const sourceForeground = sourcePixelFrames.map((frame, index) =>
          index < realSourceFrameCount
            ? sourceForegroundReal[index]
            : emptyAnalysisPixels(analysisWidth, analysisHeight).pixels,
        );
        const renderedForeground = buildImportTemporalForegroundFrames(
          renderedPixelFrames,
          analysisWidth,
          analysisHeight,
        );
        timestamps.forEach((timeSeconds, index) => {
          sourceFeatures.push(
            analyseImportRenderPixels(
              sourceForeground[index],
              analysisWidth,
              analysisHeight,
              timeSeconds,
            ),
          );
          renderedFeatures.push(
            analyseImportRenderPixels(
              renderedForeground[index],
              analysisWidth,
              analysisHeight,
              timeSeconds,
            ),
          );
          perceptualFrames.push(
            compareImportRenderPixels(
              sourceForeground[index],
              renderedForeground[index],
              timeSeconds,
            ),
          );
        });

        const metrics = buildImportRenderMetrics({
          sourceFrames: sourceFeatures,
          renderedFrames: renderedFeatures,
          perceptualFrames,
          frameWidth: capturedWidth,
          frameHeight: capturedHeight,
        });
        const result: ImportRenderHarnessResult = {
          schemaVersion: RESULT_VERSION,
          harnessVersion: HARNESS_VERSION,
          rendererVersion: FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
          source: {
            durationSeconds: sourceVideo.duration,
            width: sourceVideo.videoWidth,
            height: sourceVideo.videoHeight,
          },
          rendererDurations,
          requiredProductDurationSeconds,
          metrics,
          renderedFrames,
        };
        setPhase('complete');
        emitHarnessEvent({
          type: 'complete',
          renderedFrames: renderedFrames.length,
          overallScore: metrics.overallScore,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Engine render validation failed.';
        setPhase('error', message);
        emitHarnessEvent({ type: 'error', message });
        throw error;
      } finally {
        readyWaiterRef.current = null;
        runningRef.current = false;
        controllerRef.current = null;
        setSession(null);
        if (sourceVideo) {
          sourceVideo.pause();
          sourceVideo.removeAttribute('src');
          sourceVideo.load();
        }
        engineCanvas?.removeEventListener('webglcontextlost', onContextLost);
        if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
      }
    },
    [setPhase],
  );

  useEffect(() => {
    const api: HarnessApi = {
      version: HARNESS_VERSION,
      status: () => ({
        phase: phaseRef.current,
        renderedFrames: renderedFrameCountRef.current,
        error: errorRef.current,
      }),
      renderCandidate,
    };
    window.__SHOWCRAFTER_IMPORT_RENDER__ = api;
    emitHarnessEvent({ type: 'harness-ready', harnessVersion: HARNESS_VERSION });
    return () => {
      if (window.__SHOWCRAFTER_IMPORT_RENDER__ === api) {
        delete window.__SHOWCRAFTER_IMPORT_RENDER__;
      }
    };
  }, [renderCandidate]);

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-black"
      data-import-render-harness={HARNESS_VERSION}
    >
      <input
        ref={sourceInputRef}
        data-testid="import-render-source-video"
        type="file"
        accept="video/mp4,video/webm"
        className="sr-only"
        aria-label="Source video for engine validation"
      />
      {session ? (
        <div
          key={session.generation}
          className="relative"
          style={{ width: session.width, height: session.height }}
          aria-hidden="true"
        >
          <FireworkReplayCanvas
            cues={session.cues}
            elapsed={0}
            playbackRef={playbackRef}
            muted
            interactive={false}
            allowWheelZoom={false}
            controlsVisible={false}
            showCameraControls={false}
            showFps={false}
            maxDevicePixelRatio={1}
            antialias
            primeSnapshots={false}
            cuesFinal
            onReady={onEngineReady}
            showLoadingBar={false}
            showStarfield={false}
            preserveDrawingBuffer
            onCaptureController={onController}
          />
        </div>
      ) : null}
    </main>
  );
}
