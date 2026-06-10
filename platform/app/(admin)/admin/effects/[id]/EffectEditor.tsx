'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Pause, Play, Repeat, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { updateEffect } from '@/app/actions/admin-effects';
import { EffectPreviewIcon } from '@/app/components/admin/EffectPreviewIcon';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Field, FieldError, FieldHint, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert, Skeleton } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { Toggle } from '@/app/components/ui/Toggle';
import { toast } from '@/app/components/ui/toast';
import { Slider } from '@/components/ui/slider';
import type { AdminEffectDetail } from '@/lib/admin.types';
import {
  compileFireworkDesign,
  estimateDesignDurationSeconds,
  FIREWORK_PATTERNS,
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

const FAMILY_OPTIONS = [
  { value: 'aerial_burst', label: 'Aerial burst' },
  { value: 'ascending', label: 'Ascending' },
  { value: 'ground', label: 'Ground' },
  { value: 'noise', label: 'Noise' },
  { value: 'compound', label: 'Compound' },
];

const RENDER_PATTERN_OPTIONS = FIREWORK_PATTERNS.map((pattern) => ({
  value: pattern,
  label: pattern,
}));

const BOOM_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
];

const PREVIEW_COLOR = '#22d3ee';
const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
const PREVIEW_LAUNCH_POSITIONS: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];
/** Half-widths of the random bands the friendly brocade sliders write. */
const BROCADE_SPEED_HALF_WIDTH = 0.6;
const BROCADE_LIFE_HALF_WIDTH = 0.6;
const BROCADE_GRAVITY_HALF_WIDTH = 0.12;
const MIN_RENDER_SIZE = 20;

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

function finiteNumber(value: string, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function rangeValue(value: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(value)) return fallback;
  const first = Number(value[0]);
  const second = Number(value[1]);
  return [
    Number.isFinite(first) ? first : fallback[0],
    Number.isFinite(second) ? second : fallback[1],
  ];
}

function hasConcreteRendererColor(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const renderDefaults = readRecord(value, 'renderDefaults');
  const color = renderDefaults.color ?? value.color;
  return color !== undefined && color !== 'random';
}

function rendererColorToHex(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  const toByte = (channel: unknown) =>
    Math.max(0, Math.min(255, Math.round(Number(channel) * 255)));
  const channels = [value.r, value.g, value.b];
  if (!channels.every((channel) => Number.isFinite(Number(channel)))) return fallback;
  return `#${channels.map((channel) => toByte(channel).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRendererRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  const to01 = (byte: number) => Math.round((byte / 255) * 1000) / 1000;
  return { r: to01((int >> 16) & 0xff), g: to01((int >> 8) & 0xff), b: to01(int & 0xff) };
}

function rangeMid(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

function rangeUpper(range: [number, number]): number {
  return Math.max(range[0], range[1]);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatSeconds(value: number): string {
  return `${value.toFixed(1)}s`;
}

function ReplayCanvasSkeleton() {
  return <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-[#0b1020]" />;
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = '1',
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={String(value)}
        disabled={disabled}
        onChange={(event) => onChange(finiteNumber(event.currentTarget.value, value))}
      />
    </Field>
  );
}

function ColorField({
  label,
  value,
  hint,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  disabled?: boolean;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-9 w-14 cursor-pointer rounded-md border border-[color:var(--color-border-subtle)] bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <span className="font-mono text-xs text-[color:var(--color-content-subtle)]">{value}</span>
      </div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </Field>
  );
}

function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 border-t border-[color:var(--color-border-subtle)] pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function EffectEditor({ effect }: { effect: AdminEffectDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? '');
  const [family, setFamily] = useState(effect.family);
  const [patternKey, setPatternKey] = useState(effect.patternKey);
  const [sortOrder, setSortOrder] = useState(String(effect.sortOrder));
  const [modelText, setModelText] = useState(JSON.stringify(effect.modelJson, null, 2));
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(effect.updatedAt);
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);

  const parsedModel = useMemo(() => parseJsonObject(modelText), [modelText]);
  const baseModel = parsedModel.ok ? parsedModel.value : effect.modelJson;
  const modelRecord = parsedModel.ok ? parsedModel.value : {};
  const renderDefaults = readRecord(modelRecord, 'renderDefaults');
  const burstDefaults = readRecord(renderDefaults, 'burst');
  const flairDefaults = readRecord(renderDefaults, 'flair');
  const crackleDefaults = readRecord(renderDefaults, 'crackle');
  const soundDefaults = readRecord(renderDefaults, 'sound');
  const modelHasColour = hasConcreteRendererColor(baseModel);
  const previewDesign = useMemo(
    () =>
      compileFireworkDesign({
        baseModel,
        primaryColor: modelHasColour ? null : PREVIEW_COLOR,
      }),
    [baseModel, modelHasColour],
  );
  const previewColour = rendererColorToHex(previewDesign.color, PREVIEW_COLOR);
  const isBrocade = previewDesign.geometry === 'crown' && previewDesign.trailProfile === 'glitter';
  // Full launch-to-fade window for the timeline, rounded up to a half second.
  const previewDuration = useMemo(() => {
    const estimated = PREVIEW_CUE_TIME_SECONDS + estimateDesignDurationSeconds(previewDesign);
    return Math.max(4, Math.ceil(estimated * 2) / 2);
  }, [previewDesign]);
  const rendererPattern = RENDER_PATTERN_OPTIONS.some(
    (option) => option.value === renderDefaults.pattern,
  )
    ? (renderDefaults.pattern as string)
    : previewDesign.pattern;
  const boomValue = BOOM_OPTIONS.some((option) => option.value === soundDefaults.boom)
    ? (soundDefaults.boom as string)
    : previewDesign.sound.boom;
  const liftVelocity = previewDesign.liftVelocity ?? 11 + Math.min(previewDesign.size / 40, 6);
  const previewCue = useMemo<ReplayCue>(
    () => ({
      id: `${effect.id}-base-preview`,
      position: 1,
      timeSeconds: PREVIEW_CUE_TIME_SECONDS,
      description: description || name,
      productId: effect.id,
      launchPositionIndex: 0,
      firework: {
        id: effect.id,
        slug: effect.slug,
        name,
        description: description || null,
        sortOrder: Number(sortOrder) || effect.sortOrder,
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
          name,
          patternKey,
        },
        variant: null,
      },
    }),
    [
      baseModel,
      description,
      effect.id,
      effect.slug,
      effect.sortOrder,
      name,
      patternKey,
      previewDesign,
      previewDuration,
      sortOrder,
    ],
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
    const draft = cloneRecord(parsedModel.value);
    const defaults = ensureRecord(draft, 'renderDefaults');
    updater(defaults);
    setModelText(JSON.stringify(draft, null, 2));
  }

  function setRenderValue(key: string, value: unknown) {
    updateModelDefaults((defaults) => {
      defaults[key] = value;
    });
  }

  function setNestedRenderValue(section: string, key: string, value: unknown) {
    updateModelDefaults((defaults) => {
      const target = ensureRecord(defaults, section);
      target[key] = value;
    });
  }

  function setBurstRange(key: 'speed' | 'gravity' | 'life', index: 0 | 1, value: number) {
    updateModelDefaults((defaults) => {
      const burst = ensureRecord(defaults, 'burst');
      const fallback = previewDesign.burst[key];
      const next = rangeValue(burst[key], fallback);
      next[index] = value;
      burst[key] = next;
    });
  }

  /** Writes a [mid - halfWidth, mid + halfWidth] random band for the friendly sliders. */
  function setBurstRangeMid(key: 'speed' | 'gravity' | 'life', mid: number, halfWidth: number) {
    updateModelDefaults((defaults) => {
      const burst = ensureRecord(defaults, 'burst');
      burst[key] = [round2(mid - halfWidth), round2(mid + halfWidth)];
    });
  }

  function setBrocadeGravityUpper(maxGravity: number) {
    updateModelDefaults((defaults) => {
      const burst = ensureRecord(defaults, 'burst');
      const upper = Math.min(0, maxGravity);
      burst.gravity = [round2(upper - BROCADE_GRAVITY_HALF_WIDTH), round2(upper)];
    });
  }

  function setBrocadeValue(key: string, value: unknown) {
    updateModelDefaults((defaults) => {
      const brocade = ensureRecord(defaults, 'brocade');
      brocade[key] = value;
    });
  }

  function setStreakCount(value: number) {
    updateModelDefaults((defaults) => {
      const brocade = ensureRecord(defaults, 'brocade');
      brocade.streakCount = value;
      // Keep legacy fallback valid without breaking the design schema when
      // brocade streak counts are deliberately below the generic size minimum.
      defaults.size = Math.max(MIN_RENDER_SIZE, value);
    });
  }

  function setBrocadeColor(group: 'headColors' | 'palette', key: string, hex: string) {
    const rgb = hexToRendererRgb(hex);
    if (!rgb) return;
    updateModelDefaults((defaults) => {
      const brocade = ensureRecord(defaults, 'brocade');
      const target = ensureRecord(brocade, group);
      target[key] = rgb;
    });
  }

  function saveEffect() {
    setError(null);
    if (!parsedModel.ok) {
      setError(parsedModel.error);
      return;
    }

    startTransition(async () => {
      const result = await updateEffect({
        id: effect.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
        name,
        description,
        family: family as 'aerial_burst' | 'ascending' | 'ground' | 'noise' | 'compound',
        patternKey,
        sortOrder: Number(sortOrder),
        modelJson: modelText,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setLastSavedUpdatedAt(result.updatedAt);
      toast.success('Effect saved');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {error ? (
        <InlineAlert tone="danger" title="Could not save">
          {error}
        </InlineAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:items-start">
        <section className="min-w-0 space-y-5">
          <Card radius="lg" className="overflow-hidden p-0">
            <div className="relative h-[min(62vw,620px)] min-h-[400px] bg-[#05070d] xl:h-[min(70vh,760px)] xl:min-h-[560px]">
              <LazyFireworkReplayCanvas
                cues={[previewCue]}
                elapsed={elapsed}
                playbackRef={playbackRef}
                launchPositions={PREVIEW_LAUNCH_POSITIONS}
                muted
                interactive
                controlsVisible
              />
              <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
                <Badge tone="accent" solid>
                  Preview
                </Badge>
                <span
                  className="inline-flex h-6 items-center gap-2 rounded-full border border-white/15 bg-black/55 px-2.5 text-xs font-medium text-white backdrop-blur"
                  aria-label="Preview colour"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/30"
                    style={{ backgroundColor: previewColour }}
                    aria-hidden
                  />
                  {previewColour}
                </span>
              </div>
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

          <Card radius="lg" className="space-y-5 p-5">
            <div className="flex items-start gap-4">
              <EffectPreviewIcon preview={effect.preview} size="md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent" solid>
                    {effect.patternKey}
                  </Badge>
                  <Badge tone="neutral">{effect.source}</Badge>
                </div>
                <p className="mt-3 font-mono text-xs break-all text-[color:var(--color-content-subtle)]">
                  {effect.slug}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[color:var(--color-content-subtle)]">Family</dt>
                <dd className="mt-1 font-medium text-[color:var(--color-content-emphasis)]">
                  {effect.family}
                </dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-content-subtle)]">Variants</dt>
                <dd className="mt-1 font-mono font-medium text-[color:var(--color-content-emphasis)] tabular-nums">
                  {effect.variantCount}
                </dd>
              </div>
            </dl>
          </Card>

          <Card radius="lg" className="space-y-4 p-5">
            <Field>
              <FieldLabel htmlFor="effect-name">Name</FieldLabel>
              <Input
                id="effect-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="effect-description">Description</FieldLabel>
              <Textarea
                id="effect-description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Family</FieldLabel>
                <SelectField
                  value={family}
                  onChange={setFamily}
                  options={FAMILY_OPTIONS}
                  ariaLabel="Effect family"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pattern-key">Pattern key</FieldLabel>
                <Input
                  id="pattern-key"
                  value={patternKey}
                  onChange={(event) => setPatternKey(event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="sort-order">Sort order</FieldLabel>
              <Input
                id="sort-order"
                inputMode="numeric"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </Field>
          </Card>
        </section>

        <section className="min-w-0 xl:sticky xl:top-5">
          <Card
            radius="lg"
            className="space-y-5 p-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-[color:var(--color-content-emphasis)]">
                  <SlidersHorizontal size={16} />
                  {isBrocade ? 'Brocade Calibration' : 'Base Model'}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
                  {isBrocade
                    ? 'Tune the brocade crown look. Every change updates the preview immediately; save to keep it.'
                    : 'Shared renderer defaults for this colourless effect.'}
                </p>
              </div>
              <Button onClick={saveEffect} loading={isPending} disabled={!parsedModel.ok}>
                <Save size={16} />
                Save effect
              </Button>
            </div>

            {isBrocade ? (
              <div className="space-y-5">
                <PanelSection
                  title="Burst"
                  description="The shape and energy of the crown at the moment it opens."
                >
                  <div className="grid gap-x-6 gap-y-4">
                    <SliderField
                      label="Streak count"
                      min={8}
                      max={64}
                      step={1}
                      value={
                        previewDesign.brocade.streakCount ??
                        Math.min(64, Math.max(8, Math.round(previewDesign.size)))
                      }
                      disabled={!parsedModel.ok}
                      hint="How many streaks the shell splits into. 20 reads as a small cake; 60 is a full display crown."
                      onChange={setStreakCount}
                    />
                    <SliderField
                      label="Burst size"
                      min={0.5}
                      max={12}
                      step={0.1}
                      value={round2(rangeMid(previewDesign.burst.speed))}
                      disabled={!parsedModel.ok}
                      hint="How far the streaks fly from the centre. 2.5 is garden-size, 4.8 is a wide display sphere, 8+ is an extra-wide crown."
                      onChange={(value) =>
                        setBurstRangeMid('speed', value, BROCADE_SPEED_HALF_WIDTH)
                      }
                    />
                    <SliderField
                      label="Hang time"
                      min={0.5}
                      max={8}
                      step={0.1}
                      value={round2(rangeMid(previewDesign.burst.life))}
                      formatValue={formatSeconds}
                      disabled={!parsedModel.ok}
                      hint="How long the streak heads burn before fading. Trails always melt away just before their head does."
                      onChange={(value) => setBurstRangeMid('life', value, BROCADE_LIFE_HALF_WIDTH)}
                    />
                    <SliderField
                      label="Floatiness"
                      min={-1.85}
                      max={0}
                      step={0.01}
                      value={round2(rangeUpper(previewDesign.burst.gravity))}
                      disabled={!parsedModel.ok}
                      hint="0 keeps the stars almost perfectly flat; more negative values let them sink faster after the burst."
                      onChange={setBrocadeGravityUpper}
                    />
                  </div>
                </PanelSection>

                <PanelSection
                  title="Trails"
                  description="The square embers each streak lays down along its arc."
                >
                  <div className="grid gap-x-6 gap-y-4">
                    <SliderField
                      label="Trail spacing"
                      min={1}
                      max={10}
                      step={0.1}
                      value={previewDesign.brocade.trailStep}
                      disabled={!parsedModel.ok}
                      hint="Gap between squares along each streak. Lower packs them into near-solid streaks; higher gives dotted trails."
                      onChange={(value) => setBrocadeValue('trailStep', round2(value))}
                    />
                    <SliderField
                      label="Trail thickness"
                      min={0.5}
                      max={12}
                      step={0.1}
                      value={previewDesign.brocade.tubeRadius}
                      disabled={!parsedModel.ok}
                      hint="How far squares scatter around the streak line. 1 is a pencil line; 6 is a fat, fluffy arm."
                      onChange={(value) => setBrocadeValue('tubeRadius', round2(value))}
                    />
                    <SliderField
                      label="Square size"
                      min={0.4}
                      max={4}
                      step={0.1}
                      value={previewDesign.trail.thickness}
                      disabled={!parsedModel.ok}
                      hint="Size of each trail square. The exemplar look sits around 1.0 to 1.5."
                      onChange={(value) =>
                        setNestedRenderValue('trail', 'thickness', round2(value))
                      }
                    />
                    <SliderField
                      label="Trail persistence"
                      min={0.2}
                      max={4}
                      step={0.1}
                      value={previewDesign.trail.streakLife}
                      disabled={!parsedModel.ok}
                      hint="How long each square lives before it pops or fades. Higher leaves longer-burning tails behind the heads."
                      onChange={(value) =>
                        setNestedRenderValue('trail', 'streakLife', round2(value))
                      }
                    />
                  </div>
                  <Toggle
                    checked={
                      typeof flairDefaults.enabled === 'boolean'
                        ? flairDefaults.enabled
                        : previewDesign.flair.enabled
                    }
                    onChange={(value) => setNestedRenderValue('flair', 'enabled', value)}
                    disabled={!parsedModel.ok}
                    label="Streak trails"
                    description="Turn the square trails off entirely to see just the bare heads."
                  />
                </PanelSection>

                <PanelSection
                  title="Heads"
                  description="The glowing green and red orbs that lead each streak."
                >
                  <div className="grid gap-x-6 gap-y-4">
                    <SliderField
                      label="Head size"
                      min={100}
                      max={4000}
                      step={50}
                      value={previewDesign.brocade.headSize}
                      disabled={!parsedModel.ok}
                      hint="Size budget for each glowing head. 900 matches a display shell; heads always stay bigger than their trail squares when you zoom in."
                      onChange={(value) => setBrocadeValue('headSize', value)}
                    />
                    <SliderField
                      label="Glow strength"
                      min={0}
                      max={3}
                      step={0.05}
                      value={previewDesign.brocade.glowStrength}
                      disabled={!parsedModel.ok}
                      hint="Halo brightness around each head, and how strongly the burst tints the ground light. 0 is a bare core, 1 is standard, 2+ matches the exemplar bloom."
                      onChange={(value) => setBrocadeValue('glowStrength', round2(value))}
                    />
                  </div>
                </PanelSection>

                <PanelSection
                  title="Colour (temporary)"
                  description="These move to the firework level later (red brocade, green brocade, and so on). Set them here while calibrating the effect."
                >
                  <div className="grid gap-x-6 gap-y-4">
                    <SliderField
                      label="Green / red split"
                      min={0}
                      max={1}
                      step={0.05}
                      value={previewDesign.brocade.greenRatio}
                      formatValue={(value) => `${Math.round(value * 100)}% green`}
                      disabled={!parsedModel.ok}
                      hint="Chance each head comes out green rather than red. 50% is an even mix like the exemplar."
                      onChange={(value) => setBrocadeValue('greenRatio', round2(value))}
                    />
                  </div>
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <ColorField
                      label="Head green"
                      value={rendererColorToHex(previewDesign.brocade.headColors.green, '#66ff80')}
                      disabled={!parsedModel.ok}
                      onChange={(hex) => setBrocadeColor('headColors', 'green', hex)}
                    />
                    <ColorField
                      label="Head red"
                      value={rendererColorToHex(previewDesign.brocade.headColors.red, '#ff4852')}
                      disabled={!parsedModel.ok}
                      onChange={(hex) => setBrocadeColor('headColors', 'red', hex)}
                    />
                    <ColorField
                      label="Trail hot core"
                      value={rendererColorToHex(previewDesign.brocade.palette.hot, '#ffedb8')}
                      hint="Colour of fresh squares near the burst centre."
                      disabled={!parsedModel.ok}
                      onChange={(hex) => setBrocadeColor('palette', 'hot', hex)}
                    />
                    <ColorField
                      label="Trail ember tip"
                      value={rendererColorToHex(previewDesign.brocade.palette.ember, '#ff6b24')}
                      hint="Colour the squares cool toward as they age."
                      disabled={!parsedModel.ok}
                      onChange={(hex) => setBrocadeColor('palette', 'ember', hex)}
                    />
                  </div>
                </PanelSection>

                <PanelSection title="Launch" description="The mortar shot before the burst.">
                  <div className="grid gap-x-6 gap-y-4">
                    <SliderField
                      label="Lift velocity"
                      min={4}
                      max={40}
                      step={0.1}
                      value={round2(liftVelocity)}
                      disabled={!parsedModel.ok}
                      hint="Launch speed, which sets the burst height. 12.6 is the calibrated default."
                      onChange={(value) => setRenderValue('liftVelocity', round2(value))}
                    />
                    <SliderField
                      label="Smoke particles"
                      min={0}
                      max={500}
                      step={10}
                      value={previewDesign.mortar.smokeParticles}
                      disabled={!parsedModel.ok}
                      hint="Ground smoke puffed out by the mortar at launch."
                      onChange={(value) => setNestedRenderValue('mortar', 'smokeParticles', value)}
                    />
                    <Field>
                      <FieldLabel>Boom</FieldLabel>
                      <SelectField
                        value={boomValue}
                        onChange={(value) => setNestedRenderValue('sound', 'boom', value)}
                        options={BOOM_OPTIONS}
                        ariaLabel="Boom"
                        disabled={!parsedModel.ok}
                      />
                      <FieldHint>Detonation sound weight when the shell opens.</FieldHint>
                    </Field>
                  </div>
                </PanelSection>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel>Renderer pattern</FieldLabel>
                    <SelectField
                      value={rendererPattern}
                      onChange={(value) => setRenderValue('pattern', value)}
                      options={RENDER_PATTERN_OPTIONS}
                      ariaLabel="Renderer pattern"
                      disabled={!parsedModel.ok}
                    />
                  </Field>
                  <NumberField
                    id="render-size"
                    label="Particles"
                    min={20}
                    max={370}
                    value={previewDesign.size}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setRenderValue('size', value)}
                  />
                  <NumberField
                    id="render-lift-velocity"
                    label="Lift velocity"
                    min={4}
                    max={40}
                    step="0.1"
                    value={liftVelocity}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setRenderValue('liftVelocity', value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <NumberField
                    id="render-shell-life"
                    label="Shell life"
                    min={2}
                    max={60}
                    step="0.1"
                    value={previewDesign.shellLife}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setRenderValue('shellLife', value)}
                  />
                  <Field>
                    <FieldLabel>Boom</FieldLabel>
                    <SelectField
                      value={boomValue}
                      onChange={(value) => setNestedRenderValue('sound', 'boom', value)}
                      options={BOOM_OPTIONS}
                      ariaLabel="Boom"
                      disabled={!parsedModel.ok}
                    />
                  </Field>
                  <NumberField
                    id="render-smoke-particles"
                    label="Smoke particles"
                    min={0}
                    max={500}
                    value={previewDesign.mortar.smokeParticles}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setNestedRenderValue('mortar', 'smokeParticles', value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <NumberField
                    id="render-burst-speed-min"
                    label="Speed min"
                    step="0.1"
                    value={rangeValue(burstDefaults.speed, previewDesign.burst.speed)[0]}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setBurstRange('speed', 0, value)}
                  />
                  <NumberField
                    id="render-burst-speed-max"
                    label="Speed max"
                    step="0.1"
                    value={rangeValue(burstDefaults.speed, previewDesign.burst.speed)[1]}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setBurstRange('speed', 1, value)}
                  />
                  <NumberField
                    id="render-burst-life-min"
                    label="Spark life min"
                    min={0.5}
                    max={6.5}
                    step="0.1"
                    value={rangeValue(burstDefaults.life, previewDesign.burst.life)[0]}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setBurstRange('life', 0, value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <NumberField
                    id="render-burst-life-max"
                    label="Spark life max"
                    min={0.5}
                    max={6.5}
                    step="0.1"
                    value={rangeValue(burstDefaults.life, previewDesign.burst.life)[1]}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setBurstRange('life', 1, value)}
                  />
                  <NumberField
                    id="render-gravity-min"
                    label="Gravity min"
                    step="0.01"
                    value={rangeValue(burstDefaults.gravity, previewDesign.burst.gravity)[0]}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setBurstRange('gravity', 0, value)}
                  />
                  <NumberField
                    id="render-gravity-max"
                    label="Gravity max"
                    step="0.01"
                    value={rangeValue(burstDefaults.gravity, previewDesign.burst.gravity)[1]}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setBurstRange('gravity', 1, value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <NumberField
                    id="render-streak-size"
                    label="Streak size"
                    min={0.4}
                    max={4}
                    step="0.1"
                    value={previewDesign.trail.streakSize}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setNestedRenderValue('trail', 'streakSize', value)}
                  />
                  <NumberField
                    id="render-streak-length"
                    label="Streak length"
                    min={0.4}
                    max={4}
                    step="0.1"
                    value={previewDesign.trail.streakLength}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setNestedRenderValue('trail', 'streakLength', value)}
                  />
                  <NumberField
                    id="render-streak-life"
                    label="Streak life"
                    min={0.2}
                    max={4}
                    step="0.1"
                    value={previewDesign.trail.streakLife}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setNestedRenderValue('trail', 'streakLife', value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <NumberField
                    id="render-crackle-probability"
                    label="Crackle probability"
                    min={0}
                    max={1}
                    step="0.01"
                    value={previewDesign.crackle.probability}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setNestedRenderValue('crackle', 'probability', value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Toggle
                    checked={
                      typeof flairDefaults.enabled === 'boolean'
                        ? flairDefaults.enabled
                        : previewDesign.flair.enabled
                    }
                    onChange={(value) => setNestedRenderValue('flair', 'enabled', value)}
                    disabled={!parsedModel.ok}
                    label="Flair trails"
                    description="Persistent glow and sparkle trails after the burst."
                  />
                  <Toggle
                    checked={
                      typeof crackleDefaults.enabled === 'boolean'
                        ? crackleDefaults.enabled
                        : previewDesign.crackle.enabled
                    }
                    onChange={(value) => setNestedRenderValue('crackle', 'enabled', value)}
                    disabled={!parsedModel.ok}
                    label="Crackle"
                    description="Fragment sparkle and crackle behaviour in the base pattern."
                  />
                </div>
              </>
            )}
          </Card>
        </section>
      </div>

      <Card radius="lg" className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
              Model JSON
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
              Colourless renderer defaults for this base pattern.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={saveEffect}
            loading={isPending}
            disabled={!parsedModel.ok}
          >
            <Save size={16} />
            Save effect
          </Button>
        </div>

        <Field>
          <FieldLabel htmlFor="model-json">Base model</FieldLabel>
          <Textarea
            id="model-json"
            rows={24}
            value={modelText}
            onChange={(event) => setModelText(event.target.value)}
            className="font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          <FieldError>{parsedModel.ok ? null : parsedModel.error}</FieldError>
        </Field>
      </Card>
    </div>
  );
}
