'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Pause, Play, Repeat, RotateCcw, Save } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { updateEffect } from '@/app/actions/admin-effects';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert, Skeleton } from '@/app/components/ui/Feedback';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { Input } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { Toggle } from '@/app/components/ui/Toggle';
import { toast } from '@/app/components/ui/toast';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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

const RENDER_PATTERN_OPTIONS = FIREWORK_PATTERNS.map((pattern) => ({
  value: pattern,
  label: pattern,
}));

const BOOM_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
];

const TRAIL_MODE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'spark', label: 'Spark dust' },
  { value: 'streak', label: 'Solid streaks' },
];

const TRAIL_COLOR_OPTIONS = [
  { value: 'star', label: 'Star colour' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'ember', label: 'Ember' },
  { value: 'starFade', label: 'Star, fading to ember' },
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

function hasConcreteRendererColor(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const renderDefaults = readRecord(value, 'renderDefaults');
  const color = renderDefaults.color ?? value.color;
  return color !== undefined && color !== 'random';
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

function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 border-t border-[color:var(--color-border-subtle)] pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2.5">
        <h3 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
          {title}
        </h3>
        {action}
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
  const [modelText, setModelText] = useState(JSON.stringify(effect.modelJson, null, 2));
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(effect.updatedAt);
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);
  const trailsToggleId = useId();
  const headsToggleId = useId();

  const parsedModel = useMemo(() => parseJsonObject(modelText), [modelText]);
  const baseModel = parsedModel.ok ? parsedModel.value : effect.modelJson;
  const modelRecord = parsedModel.ok ? parsedModel.value : {};
  const renderDefaults = readRecord(modelRecord, 'renderDefaults');
  const flairDefaults = readRecord(renderDefaults, 'flair');
  const strobeDefaults = readRecord(renderDefaults, 'strobe');
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
  const isBrocade = previewDesign.geometry === 'crown' && previewDesign.trailProfile === 'glitter';
  const trailsEnabled =
    typeof flairDefaults.enabled === 'boolean'
      ? flairDefaults.enabled
      : previewDesign.flair.enabled;
  const headsEnabled = previewDesign.brocade.headsEnabled;
  const starHeadsEnabled = previewDesign.stars.heads.enabled;
  const trailMode = previewDesign.stars.trail.mode;
  const strobeEnabled =
    typeof strobeDefaults.enabled === 'boolean'
      ? strobeDefaults.enabled
      : previewDesign.strobe.enabled;
  const crackleEnabled =
    typeof crackleDefaults.enabled === 'boolean'
      ? crackleDefaults.enabled
      : previewDesign.crackle.enabled;
  const showSplitControls = previewDesign.split.enabled || previewDesign.geometry === 'split_cross';
  const showPistilControls = previewDesign.pistil.enabled || previewDesign.geometry === 'pistil';
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

  /** Writes `renderDefaults.stars.<group>.<key>` for the shared physics panel. */
  function setStarsValue(group: 'heads' | 'trail', key: string, value: unknown) {
    updateModelDefaults((defaults) => {
      const stars = ensureRecord(defaults, 'stars');
      const target = ensureRecord(stars, group);
      target[key] = value;
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
        name: effect.name,
        description: effect.description ?? '',
        family: effect.family as 'aerial_burst' | 'ascending' | 'ground' | 'noise' | 'compound',
        patternKey: effect.patternKey,
        sortOrder: effect.sortOrder,
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
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 pb-8">
          {error ? (
            <InlineAlert tone="danger" title="Could not save">
              {error}
            </InlineAlert>
          ) : null}

          {isBrocade ? (
            <>
              <PanelSection title="Burst">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
                    onChange={(value) => setBurstRangeMid('speed', value, BROCADE_SPEED_HALF_WIDTH)}
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

              <PanelSection title="Launch">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
                    <div className="flex items-center gap-1.5">
                      <FieldLabel>Boom</FieldLabel>
                      <InfoTooltip text="Detonation sound weight when the shell opens." />
                    </div>
                    <SelectField
                      value={boomValue}
                      onChange={(value) => setNestedRenderValue('sound', 'boom', value)}
                      options={BOOM_OPTIONS}
                      ariaLabel="Boom"
                      disabled={!parsedModel.ok}
                    />
                  </Field>
                </div>
              </PanelSection>

              <PanelSection
                title="Trails"
                action={
                  <div className="flex items-center gap-1.5">
                    <InfoTooltip text="Turn the square trails off entirely to see just the bare heads." />
                    <Switch
                      id={trailsToggleId}
                      aria-label="Show trails"
                      checked={trailsEnabled}
                      onCheckedChange={(value) => setNestedRenderValue('flair', 'enabled', value)}
                      disabled={!parsedModel.ok}
                    />
                  </div>
                }
              >
                {trailsEnabled ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
                ) : null}
              </PanelSection>

              <PanelSection
                title="Heads"
                action={
                  <div className="flex items-center gap-1.5">
                    <InfoTooltip text="Turn the glowing head orbs off to leave just the trails." />
                    <Switch
                      id={headsToggleId}
                      aria-label="Show heads"
                      checked={headsEnabled}
                      onCheckedChange={(value) => setBrocadeValue('headsEnabled', value)}
                      disabled={!parsedModel.ok}
                    />
                  </div>
                }
              >
                {headsEnabled ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
                ) : null}
              </PanelSection>
            </>
          ) : (
            <>
              <PanelSection title="Burst">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <SliderField
                    label="Star count"
                    min={20}
                    max={370}
                    step={2}
                    value={previewDesign.size}
                    disabled={!parsedModel.ok}
                    hint="How many stars the shell breaks into. Spheres read well from 150; tails and comets use far fewer."
                    onChange={(value) => setRenderValue('size', value)}
                  />
                  <SliderField
                    label="Burst size"
                    min={0.5}
                    max={12}
                    step={0.1}
                    value={round2(rangeMid(previewDesign.burst.speed))}
                    disabled={!parsedModel.ok}
                    hint="How far the stars fly from the centre. 2.5 is garden-size; 4.5 is a wide display sphere."
                    onChange={(value) => setBurstRangeMid('speed', value, BROCADE_SPEED_HALF_WIDTH)}
                  />
                  <SliderField
                    label="Hang time"
                    min={0.5}
                    max={8}
                    step={0.1}
                    value={round2(rangeMid(previewDesign.burst.life))}
                    formatValue={formatSeconds}
                    disabled={!parsedModel.ok}
                    hint="How long the stars burn before fading. Willow and horsetail hang longest."
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

              <PanelSection title="Launch">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <SliderField
                    label="Lift velocity"
                    min={4}
                    max={40}
                    step={0.1}
                    value={round2(liftVelocity)}
                    disabled={!parsedModel.ok}
                    hint="Launch speed, which sets the burst height. Mines and ground effects sit low."
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
                    <div className="flex items-center gap-1.5">
                      <FieldLabel>Boom</FieldLabel>
                      <InfoTooltip text="Detonation sound weight when the shell opens." />
                    </div>
                    <SelectField
                      value={boomValue}
                      onChange={(value) => setNestedRenderValue('sound', 'boom', value)}
                      options={BOOM_OPTIONS}
                      ariaLabel="Boom"
                      disabled={!parsedModel.ok}
                    />
                  </Field>
                </div>
              </PanelSection>

              <PanelSection
                title="Stars"
                action={
                  <div className="flex items-center gap-1.5">
                    <InfoTooltip text="Render each star as a glowing orb. Off falls back to simple point sparks." />
                    <Switch
                      id={headsToggleId}
                      aria-label="Glowing star orbs"
                      checked={starHeadsEnabled}
                      onCheckedChange={(value) => setStarsValue('heads', 'enabled', value)}
                      disabled={!parsedModel.ok}
                    />
                  </div>
                }
              >
                {starHeadsEnabled ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <SliderField
                      label="Star size"
                      min={40}
                      max={4000}
                      step={20}
                      value={previewDesign.stars.heads.size}
                      disabled={!parsedModel.ok}
                      hint="Size budget for each glowing star. 250 reads as a classic display star; comets sit near 900."
                      onChange={(value) => setStarsValue('heads', 'size', value)}
                    />
                    <SliderField
                      label="Glow strength"
                      min={0}
                      max={3}
                      step={0.05}
                      value={previewDesign.stars.heads.glowStrength}
                      disabled={!parsedModel.ok}
                      hint="Halo brightness around each star. 0 is a bare core, 1 is standard, 2+ is full display bloom."
                      onChange={(value) => setStarsValue('heads', 'glowStrength', round2(value))}
                    />
                  </div>
                ) : null}
              </PanelSection>

              <PanelSection
                title="Trails"
                action={
                  <div className="flex items-center gap-1.5">
                    <InfoTooltip text="Master switch for all trail particles behind the stars." />
                    <Switch
                      id={trailsToggleId}
                      aria-label="Show trails"
                      checked={trailsEnabled}
                      onCheckedChange={(value) => setNestedRenderValue('flair', 'enabled', value)}
                      disabled={!parsedModel.ok}
                    />
                  </div>
                }
              >
                {trailsEnabled ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <Field>
                        <div className="flex items-center gap-1.5">
                          <FieldLabel>Trail style</FieldLabel>
                          <InfoTooltip text="Solid streaks lay a continuous burning line behind each star (chrysanthemum, willow, horsetail). Spark dust is a loose glitter sprinkle." />
                        </div>
                        <SelectField
                          value={previewDesign.stars.trail.mode}
                          onChange={(value) => setStarsValue('trail', 'mode', value)}
                          options={TRAIL_MODE_OPTIONS}
                          ariaLabel="Trail style"
                          disabled={!parsedModel.ok}
                        />
                      </Field>
                      {trailMode === 'streak' ? (
                        <Field>
                          <div className="flex items-center gap-1.5">
                            <FieldLabel>Trail colour</FieldLabel>
                            <InfoTooltip text="Gold and silver are the classic metallic chemistries. Star colour follows each star's own colour." />
                          </div>
                          <SelectField
                            value={previewDesign.stars.trail.colorMode}
                            onChange={(value) => setStarsValue('trail', 'colorMode', value)}
                            options={TRAIL_COLOR_OPTIONS}
                            ariaLabel="Trail colour"
                            disabled={!parsedModel.ok}
                          />
                        </Field>
                      ) : null}
                    </div>
                    {trailMode === 'streak' ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <SliderField
                          label="Trail spacing"
                          min={1}
                          max={10}
                          step={0.1}
                          value={previewDesign.stars.trail.step}
                          disabled={!parsedModel.ok}
                          hint="Gap between squares along each streak. Lower packs them into near-solid lines."
                          onChange={(value) => setStarsValue('trail', 'step', round2(value))}
                        />
                        <SliderField
                          label="Trail thickness"
                          min={0.3}
                          max={12}
                          step={0.1}
                          value={previewDesign.stars.trail.tubeRadius}
                          disabled={!parsedModel.ok}
                          hint="How far squares scatter around the streak line. 1 is a pencil line; 4 is a fat palm frond."
                          onChange={(value) => setStarsValue('trail', 'tubeRadius', round2(value))}
                        />
                        <SliderField
                          label="Square size"
                          min={0.3}
                          max={4}
                          step={0.1}
                          value={previewDesign.stars.trail.squareSize}
                          disabled={!parsedModel.ok}
                          hint="Size of each trail square. Fine effects sit near 0.6; thick comet tails above 1."
                          onChange={(value) => setStarsValue('trail', 'squareSize', round2(value))}
                        />
                        <SliderField
                          label="Trail persistence"
                          min={0.1}
                          max={4}
                          step={0.1}
                          value={previewDesign.stars.trail.lifeSeconds}
                          formatValue={formatSeconds}
                          disabled={!parsedModel.ok}
                          hint="How long each square burns. Willow and waterfall hang above 2 seconds."
                          onChange={(value) => setStarsValue('trail', 'lifeSeconds', round2(value))}
                        />
                        <SliderField
                          label="Glitter flicker"
                          min={0}
                          max={1}
                          step={0.01}
                          value={previewDesign.stars.trail.flicker}
                          disabled={!parsedModel.ok}
                          hint="Chance each square pops white-hot instead of burning steadily. 0.1 reads as gentle glitter."
                          onChange={(value) => setStarsValue('trail', 'flicker', round2(value))}
                        />
                      </div>
                    ) : null}
                    {trailMode === 'spark' ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <SliderField
                          label="Dust density"
                          min={0}
                          max={4}
                          step={0.05}
                          value={previewDesign.trail.density}
                          disabled={!parsedModel.ok}
                          hint="How much spark dust each star sheds."
                          onChange={(value) =>
                            setNestedRenderValue('trail', 'density', round2(value))
                          }
                        />
                        <SliderField
                          label="Dust length"
                          min={0.2}
                          max={4}
                          step={0.05}
                          value={previewDesign.trail.length}
                          disabled={!parsedModel.ok}
                          hint="How long the dust lingers behind each star."
                          onChange={(value) =>
                            setNestedRenderValue('trail', 'length', round2(value))
                          }
                        />
                        <SliderField
                          label="Sparkle"
                          min={0}
                          max={1}
                          step={0.01}
                          value={previewDesign.trail.sparkle}
                          disabled={!parsedModel.ok}
                          hint="Chance each dust particle flashes white-hot."
                          onChange={(value) =>
                            setNestedRenderValue('trail', 'sparkle', round2(value))
                          }
                        />
                        <SliderField
                          label="Dust thickness"
                          min={0.4}
                          max={4}
                          step={0.05}
                          value={previewDesign.trail.thickness}
                          disabled={!parsedModel.ok}
                          hint="Size of each dust particle."
                          onChange={(value) =>
                            setNestedRenderValue('trail', 'thickness', round2(value))
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </PanelSection>

              <PanelSection title="Behaviour">
                <div className="space-y-4">
                  <Toggle
                    checked={
                      typeof strobeDefaults.enabled === 'boolean'
                        ? strobeDefaults.enabled
                        : previewDesign.strobe.enabled
                    }
                    onChange={(value) => setNestedRenderValue('strobe', 'enabled', value)}
                    disabled={!parsedModel.ok}
                    label="Strobe"
                    description="Stars blink rapidly instead of burning steadily."
                  />
                  {strobeEnabled ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <SliderField
                        label="Blink rate"
                        min={2}
                        max={28}
                        step={0.5}
                        value={previewDesign.strobe.frequencyHz}
                        disabled={!parsedModel.ok}
                        hint="Flashes per second."
                        onChange={(value) => setNestedRenderValue('strobe', 'frequencyHz', value)}
                      />
                      <SliderField
                        label="Blink duty"
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={previewDesign.strobe.dutyCycle}
                        disabled={!parsedModel.ok}
                        hint="Fraction of each blink the star spends lit."
                        onChange={(value) =>
                          setNestedRenderValue('strobe', 'dutyCycle', round2(value))
                        }
                      />
                    </div>
                  ) : null}
                  <Toggle
                    checked={
                      typeof crackleDefaults.enabled === 'boolean'
                        ? crackleDefaults.enabled
                        : previewDesign.crackle.enabled
                    }
                    onChange={(value) => setNestedRenderValue('crackle', 'enabled', value)}
                    disabled={!parsedModel.ok}
                    label="Crackle"
                    description="Stars pop into crackling silver fragments as they die."
                  />
                  {crackleEnabled ? (
                    <SliderField
                      label="Crackle probability"
                      min={0}
                      max={1}
                      step={0.01}
                      value={previewDesign.crackle.probability}
                      disabled={!parsedModel.ok}
                      hint="Per-frame chance a dying star pops. 0.05 is a gentle fizz; 0.3 is a full dragon-egg cloud."
                      onChange={(value) =>
                        setNestedRenderValue('crackle', 'probability', round2(value))
                      }
                    />
                  ) : null}
                  {showSplitControls ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <SliderField
                        label="Split fragments"
                        min={2}
                        max={8}
                        step={1}
                        value={previewDesign.split.fragments}
                        disabled={!parsedModel.ok}
                        hint="How many pieces each crossette star splits into."
                        onChange={(value) => setNestedRenderValue('split', 'fragments', value)}
                      />
                      <SliderField
                        label="Split speed"
                        min={0.4}
                        max={4}
                        step={0.05}
                        value={previewDesign.split.speed}
                        disabled={!parsedModel.ok}
                        hint="How hard the fragments kick away from the split."
                        onChange={(value) => setNestedRenderValue('split', 'speed', round2(value))}
                      />
                    </div>
                  ) : null}
                  {showPistilControls ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <SliderField
                        label="Pistil size"
                        min={0.1}
                        max={0.9}
                        step={0.02}
                        value={previewDesign.pistil.sizeRatio}
                        disabled={!parsedModel.ok}
                        hint="Core star count relative to the outer petals."
                        onChange={(value) =>
                          setNestedRenderValue('pistil', 'sizeRatio', round2(value))
                        }
                      />
                      <SliderField
                        label="Pistil speed"
                        min={0.1}
                        max={0.9}
                        step={0.02}
                        value={previewDesign.pistil.speedRatio}
                        disabled={!parsedModel.ok}
                        hint="Core burst speed relative to the outer petals."
                        onChange={(value) =>
                          setNestedRenderValue('pistil', 'speedRatio', round2(value))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </PanelSection>

              <PanelSection title="Advanced">
                <div className="grid gap-4 sm:grid-cols-2">
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
                    id="render-shell-life"
                    label="Shell life"
                    min={2}
                    max={60}
                    step="0.1"
                    value={previewDesign.shellLife}
                    disabled={!parsedModel.ok}
                    onChange={(value) => setRenderValue('shellLife', value)}
                  />
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
              </PanelSection>
            </>
          )}
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
