'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Pause, Play, Repeat, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { updateEffect } from '@/app/actions/admin-effects';
import { FireworkRenderControls } from '@/app/components/admin/FireworkRenderControls';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { InlineAlert, Skeleton } from '@/app/components/ui/Feedback';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/app/components/ui/toast';
import type { AdminEffectDetail } from '@/lib/admin.types';
import {
  canonicaliseEffectModelJson,
  compileFireworkDesign,
  estimateDesignDurationSeconds,
  type LaunchPosition,
} from '@/lib/fireworks/design';
import { DEFAULT_FIREWORK_SPEC } from '@/lib/fireworks/spec';
import type { ReplayCue } from '@/lib/show-domain';

type ParsedJson = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };
type JsonRecord = Record<string, unknown>;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <ReplayCanvasSkeleton />,
  },
);

// Effects are colourless shapes, so the preview uses a neutral cyan.
const PREVIEW_COLOR = '#22d3ee';
const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
const PREVIEW_LAUNCH_POSITIONS: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];

function parseJsonObject(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: 'JSON must be an object.' };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not parse JSON.',
    };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function ensureRecord(parent: JsonRecord, key: string): JsonRecord {
  if (!isRecord(parent[key])) parent[key] = {};
  return parent[key] as JsonRecord;
}

function readRecord(parent: JsonRecord, key: string): JsonRecord {
  return isRecord(parent[key]) ? (parent[key] as JsonRecord) : {};
}

function hasConcreteRendererColor(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const renderDefaults = readRecord(value, 'renderDefaults');
  const color = renderDefaults.color ?? value.color;
  return color !== undefined && color !== 'random';
}

function ReplayCanvasSkeleton() {
  return <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-[#0b1020]" />;
}

export function EffectEditor({ effect }: { effect: AdminEffectDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [modelText, setModelText] = useState(() =>
    JSON.stringify(canonicaliseEffectModelJson(effect.modelJson), null, 2),
  );
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(effect.updatedAt);
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);

  const parsedModel = useMemo(() => parseJsonObject(modelText), [modelText]);
  const baseModel = useMemo(
    () =>
      parsedModel.ok
        ? canonicaliseEffectModelJson(parsedModel.value)
        : canonicaliseEffectModelJson(effect.modelJson),
    [effect.modelJson, parsedModel],
  );
  const modelRecord = parsedModel.ok ? baseModel : {};
  const renderDefaults = readRecord(modelRecord, 'renderDefaults');
  const modelHasColour = hasConcreteRendererColor(baseModel);
  const previewDesign = useMemo(
    () =>
      compileFireworkDesign({
        baseModel,
        primaryColor: modelHasColour ? null : PREVIEW_COLOR,
      }),
    [baseModel, modelHasColour],
  );

  // Head-orb appearance is saved on the effect's renderDefaults, so the sliders
  // read from the compiled design and write straight back into the model. The
  // canvas preview reflects the saved look, and fireworks built on this effect
  // inherit it as their starting point.
  const heads = previewDesign.stars.heads;
  const glowPadding = heads.glowPadding;
  const whiteCoreSizePercent = heads.whiteCoreSizePercent;
  const whiteCoreBlurPercent = heads.whiteCoreBlurPercent;
  const coreSoftness = heads.coreSoftness;
  const coreBrightness = heads.coreBrightness;
  const glowSize = heads.glowSize;
  const glowSoftness = heads.glowSoftness;
  const glowBlur = heads.glowBlur;

  const previewDuration = useMemo(() => {
    const estimated = PREVIEW_CUE_TIME_SECONDS + estimateDesignDurationSeconds(previewDesign);
    return Math.max(4, Math.ceil(estimated * 2) / 2);
  }, [previewDesign]);

  const previewCue = useMemo<ReplayCue>(
    () => ({
      id: `${effect.id}-base-preview`,
      position: 1,
      timeSeconds: PREVIEW_CUE_TIME_SECONDS,
      description: effect.description || effect.name,
      productId: effect.id,
      launchPositionIndex: 0,
      firework: {
        id: effect.id,
        slug: effect.slug,
        name: effect.name,
        description: effect.description ?? null,
        sortOrder: effect.sortOrder,
        durationSeconds: previewDuration,
        heightMeters: null,
        caliber: null,
        shotCount: 1,
        spec: DEFAULT_FIREWORK_SPEC,
        rawSpec: baseModel,
        renderDesign: previewDesign,
        baseEffect: {
          id: effect.id,
          slug: effect.slug,
          name: effect.name,
          patternKey: effect.patternKey,
        },
        variant: null,
      },
    }),
    [baseModel, effect, previewDesign, previewDuration],
  );

  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    let lastUiUpdate = 0;
    startedAtRef.current = performance.now() - playbackRef.current * 1000;

    function tick(now: number) {
      const raw = (now - startedAtRef.current) / 1000;
      let next = raw;
      if (raw >= previewDuration) {
        if (!isLooping) {
          playbackRef.current = previewDuration;
          setElapsed(previewDuration);
          setIsPlaying(false);
          return;
        }
        next = raw % previewDuration;
        startedAtRef.current = now - next * 1000;
      }
      playbackRef.current = next;
      if (now - lastUiUpdate > 90) {
        setElapsed(next);
        lastUiUpdate = now;
      }
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, isLooping, previewDuration]);

  function setPreviewTime(seconds: number) {
    // Re-anchor the play loop so scrubbing works mid-playback too.
    startedAtRef.current = performance.now() - seconds * 1000;
    playbackRef.current = seconds;
    setElapsed(seconds);
  }

  function updateModelDefaults(updater: (defaults: JsonRecord) => void) {
    if (!parsedModel.ok) return;
    const draft = cloneRecord(canonicaliseEffectModelJson(parsedModel.value));
    const defaults = ensureRecord(draft, 'renderDefaults');
    updater(defaults);
    setModelText(JSON.stringify(draft, null, 2));
  }

  function saveEffect() {
    setError(null);
    if (!parsedModel.ok) {
      setError(parsedModel.error);
      return;
    }
    const canonicalModelText = JSON.stringify(
      canonicaliseEffectModelJson(parsedModel.value),
      null,
      2,
    );

    startTransition(async () => {
      const result = await updateEffect({
        id: effect.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
        name: effect.name,
        description: effect.description ?? '',
        family: effect.family as 'aerial_burst' | 'ascending' | 'ground' | 'noise' | 'compound',
        patternKey: effect.patternKey,
        sortOrder: effect.sortOrder,
        modelJson: canonicalModelText,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setLastSavedUpdatedAt(result.updatedAt);
      setModelText(canonicalModelText);
      toast.success('Effect saved');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5 xl:h-[calc(100vh-6.5rem)] xl:flex-row xl:items-stretch">
      <Card radius="lg" className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div className="relative h-[min(62vw,560px)] min-h-[360px] bg-[#05070d] xl:h-auto xl:min-h-0 xl:flex-1">
          <LazyFireworkReplayCanvas
            cues={[previewCue]}
            elapsed={elapsed}
            playbackRef={playbackRef}
            launchPositions={PREVIEW_LAUNCH_POSITIONS}
            muted
            interactive
            controlsVisible
            showFps
            renderTuning={{ glowPadding, whiteCoreSizePercent, whiteCoreBlurPercent }}
            headStyle={{ coreSoftness, coreBrightness, glowSize, glowSoftness, glowBlur }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => {
                if (!isPlaying && playbackRef.current >= previewDuration - 0.05) {
                  setPreviewTime(PREVIEW_START_SECONDS);
                }
                setIsPlaying((playing) => !playing);
              }}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => {
                setIsPlaying(false);
                setPreviewTime(PREVIEW_START_SECONDS);
              }}
              aria-label="Reset preview"
            >
              <RotateCcw size={16} />
            </Button>
            <Button
              variant={isLooping ? 'primary' : 'secondary'}
              size="icon"
              onClick={() => setIsLooping((looping) => !looping)}
              aria-pressed={isLooping}
              aria-label={isLooping ? 'Disable looping' : 'Enable looping'}
            >
              <Repeat size={16} />
            </Button>
          </div>
          <Slider
            value={[Math.min(elapsed, previewDuration)]}
            min={0}
            max={previewDuration}
            step={0.05}
            onValueChange={(next) => setPreviewTime(next[0] ?? 0)}
            aria-label="Preview timeline"
            className="min-w-40 flex-1"
          />
          <div className="font-mono text-sm text-[color:var(--color-content-subtle)] tabular-nums">
            {elapsed.toFixed(1)}s / {previewDuration.toFixed(1)}s
          </div>
        </div>
      </Card>

      <Card
        radius="lg"
        className="flex w-full min-w-0 flex-col p-0 xl:w-[440px] xl:shrink-0 xl:self-stretch"
      >
        <div className="border-b border-[color:var(--color-border-subtle)] p-6 pb-4">
          <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
            {effect.name}
          </h2>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 pb-8">
          {error ? (
            <InlineAlert tone="danger" title="Could not save">
              {error}
            </InlineAlert>
          ) : null}

          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            mutate={updateModelDefaults}
            disabled={!parsedModel.ok}
            showLaunch
            showStarCount
          />
        </div>

        <div className="border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
          <Button
            className="w-full"
            onClick={saveEffect}
            loading={isPending}
            disabled={!parsedModel.ok}
          >
            <Save size={16} />
            Save effect
          </Button>
        </div>
      </Card>
    </div>
  );
}
