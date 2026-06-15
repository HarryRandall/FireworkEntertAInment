'use client';

/**
 * Shared renderer-control panels used by both the Effect editor and the
 * Firework editor.
 *
 * Both editors manipulate a design-shaped "defaults" object: for an effect it is
 * `model_json.renderDefaults` (the base shape + core feel); for a firework it is
 * `render_overrides_json` (firework-level overrides merged over the effect).
 * The parent owns where the object lives and passes a single `mutate` callback;
 * visibility flags decide which sections an editor exposes.
 */
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { SelectField } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  BURST_TRAIL_PARTICLES_PER_STAR_MAX,
  makeBurstTrailPreset,
  normaliseBurstTrailStops,
  type BurstTrailPreset,
  type FireworkDesign,
} from '@/lib/fireworks/design';
import { cn } from '@/lib/utils';
import {
  BACKGROUND_GLOW_OPACITY_FALLOFF_STEP,
  BACKGROUND_GLOW_SOFTNESS_STEP,
  CORE_BRIGHTNESS_STEP,
  CORE_OPACITY_FALLOFF_STEP,
  CORE_SOFTNESS_STEP,
  GLOW_BLUR_STEP,
  GLOW_OPACITY_FALLOFF_STEP,
  GLOW_PADDING_STEP,
  GLOW_SIZE_STEP,
  GLOW_SOFTNESS_STEP,
  MAX_BACKGROUND_GLOW_OPACITY_FALLOFF,
  MAX_BACKGROUND_GLOW_SOFTNESS,
  MAX_CORE_BRIGHTNESS,
  MAX_CORE_OPACITY_FALLOFF,
  MAX_CORE_SOFTNESS,
  MAX_GLOW_BLUR,
  MAX_GLOW_OPACITY_FALLOFF,
  MAX_GLOW_PADDING,
  MAX_GLOW_SIZE,
  MAX_GLOW_SOFTNESS,
  MAX_WHITE_CORE_BLUR_PERCENT,
  MAX_WHITE_CORE_SIZE_PERCENT,
  MIN_BACKGROUND_GLOW_OPACITY_FALLOFF,
  MIN_BACKGROUND_GLOW_SOFTNESS,
  MIN_CORE_BRIGHTNESS,
  MIN_CORE_OPACITY_FALLOFF,
  MIN_CORE_SOFTNESS,
  MIN_GLOW_BLUR,
  MIN_GLOW_OPACITY_FALLOFF,
  MIN_GLOW_PADDING,
  MIN_GLOW_SIZE,
  MIN_GLOW_SOFTNESS,
  MIN_WHITE_CORE_BLUR_PERCENT,
  MIN_WHITE_CORE_SIZE_PERCENT,
  WHITE_CORE_BLUR_PERCENT_STEP,
  WHITE_CORE_SIZE_PERCENT_STEP,
} from '@/lib/fireworks/render-tuning';

export type JsonRecord = Record<string, unknown>;

const BOOM_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
];

const TRAIL_PRESET_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'sparkDust', label: 'Spark dust' },
  { value: 'solidStreaks', label: 'Solid streaks' },
  { value: 'willowHang', label: 'Willow hang' },
  { value: 'cometTail', label: 'Comet tail' },
  { value: 'denseBrocade', label: 'Dense brocade' },
  { value: 'custom', label: 'Custom' },
];

const TRAIL_COLOR_OPTIONS = [
  { value: 'star', label: 'Star colour' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'ember', label: 'Ember' },
  { value: 'starFade', label: 'Star, fading to ember' },
];

const TRAIL_PARTICLE_SHAPE_OPTIONS = [
  { value: 'square', label: 'Square' },
  { value: 'circle', label: 'Glowing disc' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'mixed', label: 'Mixed' },
] as const;

const BROCADE_SPEED_HALF_WIDTH = 0.6;
const BROCADE_LIFE_HALF_WIDTH = 0.6;
const BROCADE_GRAVITY_HALF_WIDTH = 0.12;
const STAR_COUNT_MIN = 1;
const STAR_COUNT_MAX = 100;
const STAR_SIZE_MIN = 10;
const STAR_SIZE_MAX = 1000;
const STAR_SIZE_STEP = 10;
const TRAIL_PARTICLE_SIZE_MAX = 24;

const LIFT_VELOCITY_OPTIONS = [
  { value: 'small', label: 'Small', velocity: 7 },
  { value: 'normal', label: 'Normal', velocity: 15 },
  { value: 'high', label: 'High', velocity: 20 },
  { value: 'custom', label: 'Custom', velocity: null },
] as const;
type LiftVelocityMode = (typeof LIFT_VELOCITY_OPTIONS)[number]['value'];
function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(parent: JsonRecord, key: string): JsonRecord {
  return isRecord(parent[key]) ? (parent[key] as JsonRecord) : {};
}

function ensureRecord(parent: JsonRecord, key: string): JsonRecord {
  if (!isRecord(parent[key])) parent[key] = {};
  return parent[key] as JsonRecord;
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

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function liftVelocityPresetMode(value: number): LiftVelocityMode {
  const rounded = round2(value);
  const preset = LIFT_VELOCITY_OPTIONS.find(
    (option) => option.velocity != null && option.velocity === rounded,
  );
  return preset?.value ?? 'custom';
}

type BurstTrail = FireworkDesign['burstTrail'];
type BurstTrailStop = BurstTrail['stops'][number];
type TrailParticleShapeOption = (typeof TRAIL_PARTICLE_SHAPE_OPTIONS)[number]['value'];

const TRAIL_PARTICLE_SHAPE_WEIGHTS: Record<
  TrailParticleShapeOption,
  BurstTrailStop['shapeWeights']
> = {
  square: { circle: 0, square: 100, triangle: 0 },
  circle: { circle: 100, square: 0, triangle: 0 },
  triangle: { circle: 0, square: 0, triangle: 100 },
  mixed: { circle: 25, square: 50, triangle: 25 },
};

function cloneTrail(trail: BurstTrail): BurstTrail {
  return JSON.parse(JSON.stringify(trail)) as BurstTrail;
}

function averageShapeWeights(stops: readonly BurstTrailStop[]): BurstTrailStop['shapeWeights'] {
  if (stops.length === 0) return TRAIL_PARTICLE_SHAPE_WEIGHTS.square;
  return {
    circle: round2(stops.reduce((sum, stop) => sum + stop.shapeWeights.circle, 0) / stops.length),
    square: round2(stops.reduce((sum, stop) => sum + stop.shapeWeights.square, 0) / stops.length),
    triangle: round2(
      stops.reduce((sum, stop) => sum + stop.shapeWeights.triangle, 0) / stops.length,
    ),
  };
}

function shapeOptionFromStops(stops: readonly BurstTrailStop[]): TrailParticleShapeOption {
  const weights = averageShapeWeights(stops);
  if (weights.circle >= 75 && weights.square <= 20 && weights.triangle <= 20) return 'circle';
  if (weights.triangle >= 75 && weights.circle <= 20 && weights.square <= 20) return 'triangle';
  if (weights.square >= 75 && weights.circle <= 20 && weights.triangle <= 20) return 'square';
  return 'mixed';
}

const TRAIL_SEGMENT_LABELS = ['Head', 'Middle', 'Tail'] as const;
const TRAIL_SEGMENT_POSITIONS = [0, 50, 100] as const;
const TRAIL_SEGMENT_WEIGHT_MAX = 4;

/**
 * Collapses the trail's editable stops into three logical segments, head
 * (freshest, position 0), middle, and tail (oldest, position 100). The
 * per-segment editor reads and writes these so the user controls where the
 * trail bunches its particles and how it tapers, instead of the opaque
 * front-clump number.
 */
function trailSegmentStops(stops: readonly BurstTrailStop[]): BurstTrailStop[] {
  const sorted = normaliseBurstTrailStops(stops);
  const head = sorted[0];
  const tail = sorted[sorted.length - 1];
  const middle =
    sorted.length >= 3
      ? sorted[Math.round((sorted.length - 1) / 2)]
      : {
          ...head,
          position: 50,
          density: round2((head.density + tail.density) / 2),
          size: round2((head.size + tail.size) / 2),
        };
  return [head, middle, tail].map((stop) => ({
    ...stop,
    shapeWeights: { ...stop.shapeWeights },
  }));
}

function PanelSection({
  title,
  titleAccessory,
  action,
  collapsible = false,
  defaultExpanded = true,
  inactive = false,
  children,
}: {
  title: string;
  titleAccessory?: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  inactive?: boolean;
  children: ReactNode;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showContent = collapsible ? expanded : true;
  const titleClassName = cn(
    'text-sm font-semibold',
    inactive ? 'text-muted-foreground' : 'text-[color:var(--color-content-emphasis)]',
  );

  return (
    <div className="space-y-4 border-t border-[color:var(--color-border-subtle)] pt-5 first:border-t-0 first:pt-0">
      <div className="flex min-h-10 items-center gap-2.5">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            className="focus-visible:ring-ring/50 hover:text-foreground focus-visible:ring-offset-background -ml-1 flex min-h-10 items-center gap-2 rounded-md px-1 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown
              className={cn(
                'text-muted-foreground size-4 shrink-0 transition-transform',
                !expanded && '-rotate-90',
              )}
              aria-hidden
            />
            <span className={titleClassName}>{title}</span>
          </button>
        ) : (
          <div className="flex min-h-10 items-center gap-2">
            <h3 className={titleClassName}>{title}</h3>
          </div>
        )}
        {titleAccessory ? <div className="flex items-center">{titleAccessory}</div> : null}
        {action ? <div className="ml-auto flex items-center gap-2.5">{action}</div> : null}
      </div>
      {showContent ? (
        <div id={contentId} className={cn('transition-opacity', inactive && 'opacity-55')}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Nested collapsible group inside a {@link PanelSection}. Used to tuck the
 * richer head and trail controls into labelled dropdowns so a panel stays
 * scannable while still exposing every knob.
 */
function SubSection({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)]">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        className="focus-visible:ring-ring/50 flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors outline-none hover:bg-[color:var(--color-bg-surface)] focus-visible:ring-2"
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            !expanded && '-rotate-90',
          )}
          aria-hidden
        />
        <span className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
          {title}
        </span>
      </button>
      {expanded ? (
        <div id={contentId} className="px-3 pt-1 pb-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type RenderControlsProps = {
  design: FireworkDesign;
  defaults: JsonRecord;
  mutate: (updater: (defaults: JsonRecord) => void) => void;
  disabled?: boolean;
  /** Show the Launch panel (lift velocity, smoke, boom). Firework-level. */
  showLaunch?: boolean;
  /** Show the star / streak count control in the Burst panel. Firework-level. */
  showStarCount?: boolean;
};

export function FireworkRenderControls({
  design,
  defaults,
  mutate,
  disabled = false,
  showLaunch = false,
  showStarCount = false,
}: RenderControlsProps) {
  const trailsToggleId = useId();
  const headsToggleId = useId();
  const strobeToggleId = useId();
  const crackleToggleId = useId();
  const [forceCustomLiftVelocity, setForceCustomLiftVelocity] = useState(false);

  const strobeDefaults = readRecord(defaults, 'strobe');
  const crackleDefaults = readRecord(defaults, 'crackle');
  const soundDefaults = readRecord(defaults, 'sound');

  const isBrocade = design.geometry === 'crown' && design.trailProfile === 'glitter';
  const burstTrail = design.burstTrail;
  const trailsEnabled = burstTrail.enabled;
  const headsEnabled = design.brocade.headsEnabled;
  const starsEnabled = design.stars.heads.enabled;
  const strobeEnabled =
    typeof strobeDefaults.enabled === 'boolean' ? strobeDefaults.enabled : design.strobe.enabled;
  const crackleEnabled =
    typeof crackleDefaults.enabled === 'boolean' ? crackleDefaults.enabled : design.crackle.enabled;
  const showSplitControls = design.split.enabled || design.geometry === 'split_cross';
  const showPistilControls = design.pistil.enabled || design.geometry === 'pistil';
  const boomValue = BOOM_OPTIONS.some((option) => option.value === soundDefaults.boom)
    ? (soundDefaults.boom as string)
    : design.sound.boom;
  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  const sectionDisabled = {
    trails: disabled || !trailsEnabled,
    heads: disabled || !headsEnabled,
    stars: disabled || !starsEnabled,
    strobe: disabled || !strobeEnabled,
    crackle: disabled || !crackleEnabled,
  };

  function setRenderValue(key: string, value: unknown) {
    mutate((draft) => {
      draft[key] = value;
    });
  }

  function setStarCount(value: number) {
    if (!Number.isFinite(value)) return;
    setRenderValue('size', Math.min(STAR_COUNT_MAX, Math.max(STAR_COUNT_MIN, Math.round(value))));
  }

  function setLiftVelocityMode(mode: LiftVelocityMode) {
    if (mode === 'custom') {
      setForceCustomLiftVelocity(true);
      return;
    }

    const option = LIFT_VELOCITY_OPTIONS.find((candidate) => candidate.value === mode);
    if (option?.velocity == null) return;
    setForceCustomLiftVelocity(false);
    setRenderValue('liftVelocity', option.velocity);
  }

  function renderLiftVelocityControl(hint: ReactNode) {
    const presetMode = liftVelocityPresetMode(liftVelocity);
    const selectedMode: LiftVelocityMode =
      forceCustomLiftVelocity || presetMode === 'custom' ? 'custom' : presetMode;

    return (
      <div className="space-y-3">
        <Field>
          <div className="flex items-center gap-1.5">
            <FieldLabel>Lift velocity</FieldLabel>
            <InfoTooltip text={hint} />
          </div>
          <ToggleGroup
            type="single"
            value={selectedMode}
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label="Lift velocity"
            className="grid w-full grid-cols-2 sm:grid-cols-4"
            onValueChange={(value) => {
              if (!value) return;
              setLiftVelocityMode(value as LiftVelocityMode);
            }}
          >
            {LIFT_VELOCITY_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={`Lift velocity ${option.label.toLowerCase()}`}
                className="data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary min-w-0 px-2 text-xs"
              >
                <span>{option.label}</span>
                {option.velocity == null ? null : (
                  <span className="font-mono text-[10px] tabular-nums">{option.velocity}</span>
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        {selectedMode === 'custom' ? (
          <SliderField
            label="Custom velocity"
            min={4}
            max={40}
            step={0.1}
            value={round2(liftVelocity)}
            disabled={disabled}
            hint="Manual launch speed, which sets the burst height."
            onChange={(value) => {
              setForceCustomLiftVelocity(true);
              setRenderValue('liftVelocity', round2(value));
            }}
          />
        ) : null}
      </div>
    );
  }

  function setNestedRenderValue(section: string, key: string, value: unknown) {
    mutate((draft) => {
      const target = ensureRecord(draft, section);
      target[key] = value;
    });
  }

  function setBurstRangeMid(key: 'speed' | 'gravity' | 'life', mid: number, halfWidth: number) {
    mutate((draft) => {
      const burst = ensureRecord(draft, 'burst');
      burst[key] = [round2(mid - halfWidth), round2(mid + halfWidth)];
    });
  }

  function setBrocadeGravityUpper(maxGravity: number) {
    mutate((draft) => {
      const burst = ensureRecord(draft, 'burst');
      const upper = Math.min(0, maxGravity);
      burst.gravity = [round2(upper - BROCADE_GRAVITY_HALF_WIDTH), round2(upper)];
    });
  }

  function setBrocadeValue(key: string, value: unknown) {
    mutate((draft) => {
      const brocade = ensureRecord(draft, 'brocade');
      brocade[key] = value;
    });
  }

  function setStarsValue(group: 'heads' | 'trail', key: string, value: unknown) {
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const target = ensureRecord(stars, group);
      target[key] = value;
    });
  }

  /**
   * Full head-orb appearance controls, shared by the star "Stars" panel and the
   * brocade "Heads" panel. All values are saved on `stars.heads` (the engine
   * reads head appearance from there for every effect) and feed the live preview
   * through the editor's `headStyle` / `renderTuning` props. Grouped into Core
   * and Glow so the richer set stays readable.
   */
  function renderStarAppearance(controlDisabled: boolean) {
    const heads = design.stars.heads;
    return (
      <div className="space-y-2.5">
        <SubSection title="Core" defaultExpanded>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <SliderField
              label="Core blur"
              min={MIN_CORE_SOFTNESS}
              max={MAX_CORE_SOFTNESS}
              step={CORE_SOFTNESS_STEP}
              value={heads.coreSoftness}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Blur through the coloured core. 0% is a hard-edged disc; higher diffuses the centre and edge into a soft orb."
              onChange={(value) => setStarsValue('heads', 'coreSoftness', value)}
            />
            <SliderField
              label="Brightness"
              min={MIN_CORE_BRIGHTNESS}
              max={MAX_CORE_BRIGHTNESS}
              step={CORE_BRIGHTNESS_STEP}
              value={heads.coreBrightness}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="How hot the centre burns. 100% is neutral; push higher for a bright near-white core, lower for a calmer ember."
              onChange={(value) => setStarsValue('heads', 'coreBrightness', value)}
            />
            <SliderField
              label="White dot size"
              min={MIN_WHITE_CORE_SIZE_PERCENT}
              max={MAX_WHITE_CORE_SIZE_PERCENT}
              step={WHITE_CORE_SIZE_PERCENT_STEP}
              value={heads.whiteCoreSizePercent}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Size of the white-hot centre inside each star. 0% removes it; 100% fills the coloured star core."
              onChange={(value) => setStarsValue('heads', 'whiteCoreSizePercent', value)}
            />
            <SliderField
              label="White dot blur"
              min={MIN_WHITE_CORE_BLUR_PERCENT}
              max={MAX_WHITE_CORE_BLUR_PERCENT}
              step={WHITE_CORE_BLUR_PERCENT_STEP}
              value={heads.whiteCoreBlurPercent}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Feathering on the white dot. 0% is crisp; higher adds a coloured blur outside the dot without enlarging the white area."
              onChange={(value) => setStarsValue('heads', 'whiteCoreBlurPercent', value)}
            />
            <SliderField
              label="Core fade"
              min={MIN_CORE_OPACITY_FALLOFF}
              max={MAX_CORE_OPACITY_FALLOFF}
              step={CORE_OPACITY_FALLOFF_STEP}
              value={heads.coreOpacityFalloff}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Opacity falloff for the coloured core. 0% keeps the edge solid; higher fades the core into the surrounding glow."
              onChange={(value) => setStarsValue('heads', 'coreOpacityFalloff', value)}
            />
          </div>
        </SubSection>
        <SubSection title="Glow">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <SliderField
              label="Star glow radius"
              min={MIN_GLOW_SIZE}
              max={MAX_GLOW_SIZE}
              step={GLOW_SIZE_STEP}
              value={heads.glowSize}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Size of the coloured bloom attached to the star itself. Low hugs the core; high spreads the close glow outward."
              onChange={(value) => setStarsValue('heads', 'glowSize', value)}
            />
            <SliderField
              label="Star glow blur"
              min={MIN_GLOW_SOFTNESS}
              max={MAX_GLOW_SOFTNESS}
              step={GLOW_SOFTNESS_STEP}
              value={heads.glowSoftness}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Blur of the close coloured glow. Low is tight and defined; high spreads it into a much softer bloom."
              onChange={(value) => setStarsValue('heads', 'glowSoftness', value)}
            />
            <SliderField
              label="Star glow fade"
              min={MIN_GLOW_OPACITY_FALLOFF}
              max={MAX_GLOW_OPACITY_FALLOFF}
              step={GLOW_OPACITY_FALLOFF_STEP}
              value={heads.glowOpacityFalloff}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Opacity falloff for the close star glow. Higher values fade it to transparent sooner, removing the outer ring."
              onChange={(value) => setStarsValue('heads', 'glowOpacityFalloff', value)}
            />
            <SliderField
              label="Background glow size"
              min={MIN_GLOW_PADDING}
              max={MAX_GLOW_PADDING}
              step={GLOW_PADDING_STEP}
              value={heads.glowPadding}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Size of the large coloured wash behind each star. 100% reaches one star size; 200% reaches two star sizes."
              onChange={(value) => setStarsValue('heads', 'glowPadding', value)}
            />
            <SliderField
              label="Background glow strength"
              min={MIN_GLOW_BLUR}
              max={MAX_GLOW_BLUR}
              step={GLOW_BLUR_STEP}
              value={heads.glowBlur}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Brightness of the large coloured wash behind each star. It stays coloured rather than turning the whole sprite white."
              onChange={(value) => setStarsValue('heads', 'glowBlur', value)}
            />
            <SliderField
              label="Background blur"
              min={MIN_BACKGROUND_GLOW_SOFTNESS}
              max={MAX_BACKGROUND_GLOW_SOFTNESS}
              step={BACKGROUND_GLOW_SOFTNESS_STEP}
              value={heads.backgroundGlowSoftness}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Blur of the large background wash. Higher values make the glow much more diffused without changing the star size."
              onChange={(value) => setStarsValue('heads', 'backgroundGlowSoftness', value)}
            />
            <SliderField
              label="Background fade"
              min={MIN_BACKGROUND_GLOW_OPACITY_FALLOFF}
              max={MAX_BACKGROUND_GLOW_OPACITY_FALLOFF}
              step={BACKGROUND_GLOW_OPACITY_FALLOFF_STEP}
              value={heads.backgroundGlowOpacityFalloff}
              formatValue={formatPercent}
              disabled={controlDisabled}
              hint="Opacity falloff for the large background wash. Higher values fade the outside to nothing before it reaches the sprite edge."
              onChange={(value) => setStarsValue('heads', 'backgroundGlowOpacityFalloff', value)}
            />
          </div>
        </SubSection>
      </div>
    );
  }

  function writeBurstTrail(next: BurstTrail) {
    mutate((draft) => {
      draft.burstTrail = next;
    });
  }

  function setBurstTrailPreset(preset: BurstTrailPreset) {
    writeBurstTrail(makeBurstTrailPreset(preset));
  }

  function patchBurstTrail(updater: (trail: BurstTrail) => BurstTrail, custom = true) {
    const current = cloneTrail(design.burstTrail);
    const next = updater(current);
    writeBurstTrail(custom ? { ...next, preset: 'custom' } : next);
  }

  function setBurstTrailEnabled(value: boolean) {
    patchBurstTrail((trail) => ({ ...trail, enabled: value }), false);
  }

  function setBurstTrailValue(key: keyof BurstTrail, value: unknown) {
    patchBurstTrail((trail) => ({ ...trail, [key]: value }));
  }

  function setBurstTrailNested<T extends 'width' | 'lifetime' | 'intensity' | 'flicker' | 'motion'>(
    section: T,
    key: keyof BurstTrail[T],
    value: number,
  ) {
    patchBurstTrail((trail) => ({
      ...trail,
      [section]: {
        ...trail[section],
        [key]: value,
      },
    }));
  }

  function setBurstTrailSegment(index: number, key: 'density' | 'size', value: number) {
    patchBurstTrail((trail) => {
      const source =
        trail.stops.length > 0
          ? trail.stops
          : makeBurstTrailPreset(trail.preset === 'custom' ? 'solidStreaks' : trail.preset).stops;
      const segments = trailSegmentStops(source);
      segments[index] = { ...segments[index], [key]: round2(value) };
      const stops = segments.map((stop, i) => ({
        ...stop,
        position: TRAIL_SEGMENT_POSITIONS[i],
      }));
      return { ...trail, stops: normaliseBurstTrailStops(stops) };
    });
  }

  function setStreakCount(value: number) {
    mutate((draft) => {
      const brocade = ensureRecord(draft, 'brocade');
      brocade.streakCount = value;
      draft.size = value;
    });
  }

  function renderBurstTrailControls() {
    const fallbackPreset = burstTrail.preset === 'custom' ? 'solidStreaks' : burstTrail.preset;
    const editableStops =
      burstTrail.stops.length > 0 ? burstTrail.stops : makeBurstTrailPreset(fallbackPreset).stops;
    const particleShape = shapeOptionFromStops(editableStops);
    const segments = trailSegmentStops(editableStops);

    function resetToPreset() {
      setBurstTrailPreset(fallbackPreset);
    }

    function patchBurstTrailStops(updater: (stop: BurstTrailStop) => BurstTrailStop) {
      patchBurstTrail((trail) => {
        const source =
          trail.stops.length > 0
            ? trail.stops
            : makeBurstTrailPreset(trail.preset === 'custom' ? 'solidStreaks' : trail.preset).stops;
        return {
          ...trail,
          stops: source.map((stop) => {
            const next = updater({ ...stop, shapeWeights: { ...stop.shapeWeights } });
            return { ...next, shapeWeights: { ...next.shapeWeights } };
          }),
        };
      });
    }

    function setParticleShape(value: string) {
      const shape = value as TrailParticleShapeOption;
      const weights = TRAIL_PARTICLE_SHAPE_WEIGHTS[shape] ?? TRAIL_PARTICLE_SHAPE_WEIGHTS.square;
      patchBurstTrailStops((stop) => ({ ...stop, shapeWeights: { ...weights } }));
    }

    return (
      <PanelSection
        title="Trails"
        collapsible
        defaultExpanded={trailsEnabled}
        inactive={!trailsEnabled}
        titleAccessory={
          <InfoTooltip text="Master switch for burst trail particles behind the star paths." />
        }
        action={
          <Switch
            id={trailsToggleId}
            aria-label="Show trails"
            checked={trailsEnabled}
            onCheckedChange={setBurstTrailEnabled}
            disabled={disabled}
          />
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel>Trail style</FieldLabel>
                <InfoTooltip text="Presets seed the unified burst trail model. Any numeric edit switches the trail to Custom." />
              </div>
              <SelectField
                value={burstTrail.preset}
                onChange={(value) => setBurstTrailPreset(value as BurstTrailPreset)}
                options={TRAIL_PRESET_OPTIONS}
                ariaLabel="Trail style"
                disabled={sectionDisabled.trails}
              />
            </Field>
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel>Trail colour</FieldLabel>
                <InfoTooltip text="Gold and silver are classic metallic chemistries. Star colour follows each star's own colour." />
              </div>
              <SelectField
                value={burstTrail.colourMode}
                onChange={(value) => setBurstTrailValue('colourMode', value)}
                options={TRAIL_COLOR_OPTIONS}
                ariaLabel="Trail colour"
                disabled={sectionDisabled.trails}
              />
            </Field>
          </div>

          <SubSection title="Particles" defaultExpanded>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Amount"
                min={0}
                max={BURST_TRAIL_PARTICLES_PER_STAR_MAX}
                step={1}
                value={burstTrail.particlesPerStar}
                showNumberInput
                inputAriaLabel="Amount value"
                disabled={sectionDisabled.trails}
                hint="Total number of particles in each star's trail. Higher is thicker and fuller."
                onChange={(value) => setBurstTrailValue('particlesPerStar', Math.round(value))}
              />
              <Field>
                <div className="flex items-center gap-1.5">
                  <FieldLabel>Particle shape</FieldLabel>
                  <InfoTooltip text="Shape of every trail particle: square sparks, glowing discs, triangles, or a mix." />
                </div>
                <SelectField
                  value={particleShape}
                  onChange={setParticleShape}
                  options={[...TRAIL_PARTICLE_SHAPE_OPTIONS]}
                  ariaLabel="Particle shape"
                  disabled={sectionDisabled.trails}
                />
              </Field>
            </div>
          </SubSection>

          <SubSection title="Distribution" defaultExpanded>
            <p className="text-muted-foreground mb-3 text-xs">
              Spread the trail from its bright head to its old tail. Raise a segment&apos;s weight
              to bunch more particles there, and its size to make them bigger. Head weight high with
              a thin tail bunches at the front; the reverse trails behind.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {TRAIL_SEGMENT_LABELS.flatMap((label, index) => [
                <SliderField
                  key={`${label}-weight`}
                  label={`${label} weight`}
                  min={0}
                  max={TRAIL_SEGMENT_WEIGHT_MAX}
                  step={0.05}
                  value={segments[index].density}
                  showNumberInput
                  inputAriaLabel={`${label} weight value`}
                  disabled={sectionDisabled.trails}
                  hint={`How many of the trail's particles land at the ${label.toLowerCase()} of its length.`}
                  onChange={(value) => setBurstTrailSegment(index, 'density', round2(value))}
                />,
                <SliderField
                  key={`${label}-size`}
                  label={`${label} size`}
                  min={0.08}
                  max={TRAIL_PARTICLE_SIZE_MAX}
                  step={0.05}
                  value={segments[index].size}
                  showNumberInput
                  inputAriaLabel={`${label} size value`}
                  disabled={sectionDisabled.trails}
                  hint={`Size of the particles at the ${label.toLowerCase()} of the trail.`}
                  onChange={(value) => setBurstTrailSegment(index, 'size', round2(value))}
                />,
              ])}
            </div>
          </SubSection>

          <SubSection title="Shape and length">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Trail length"
                min={0.05}
                max={8}
                step={0.05}
                value={burstTrail.lifetime.baseSeconds}
                formatValue={formatSeconds}
                showNumberInput
                inputAriaLabel="Trail length value"
                disabled={sectionDisabled.trails}
                hint="How long each trail lingers before fading. Willows and waterfalls hang longest."
                onChange={(value) => setBurstTrailNested('lifetime', 'baseSeconds', round2(value))}
              />
              <SliderField
                label="Front width"
                min={0}
                max={12}
                step={0.1}
                value={burstTrail.width.front}
                showNumberInput
                disabled={sectionDisabled.trails}
                hint="Thickness of the trail at the fresh head end."
                onChange={(value) => setBurstTrailNested('width', 'front', round2(value))}
              />
              <SliderField
                label="Tail width"
                min={0}
                max={12}
                step={0.1}
                value={burstTrail.width.tail}
                showNumberInput
                disabled={sectionDisabled.trails}
                hint="Thickness of the trail at the old tail end. Set below the front width for a tapered comet look."
                onChange={(value) => setBurstTrailNested('width', 'tail', round2(value))}
              />
            </div>
          </SubSection>

          <SubSection title="Glow">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Brightness"
                min={0}
                max={3}
                step={0.05}
                value={burstTrail.intensity.brightness}
                showNumberInput
                disabled={sectionDisabled.trails}
                hint="How brightly the trail burns. 1 is standard; push higher for a hot, glowing trail."
                onChange={(value) => setBurstTrailNested('intensity', 'brightness', round2(value))}
              />
              <SliderField
                label="Flicker"
                min={0}
                max={1}
                step={0.01}
                value={burstTrail.flicker.chance}
                disabled={sectionDisabled.trails}
                hint="Chance each particle twinkles white-hot, for a glittering, crackly trail. 0 is steady."
                onChange={(value) => setBurstTrailNested('flicker', 'chance', round2(value))}
              />
            </div>
          </SubSection>

          <Button
            type="button"
            variant="secondary"
            onClick={resetToPreset}
            disabled={disabled}
            className="w-full"
          >
            <RotateCcw size={16} />
            Reset to preset
          </Button>
        </div>
      </PanelSection>
    );
  }

  if (isBrocade) {
    return (
      <>
        <PanelSection title="Burst">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {showStarCount ? (
              <SliderField
                label="Streak count"
                min={8}
                max={64}
                step={1}
                value={
                  design.brocade.streakCount ?? Math.min(64, Math.max(8, Math.round(design.size)))
                }
                disabled={disabled}
                hint="How many streaks the shell splits into. 20 reads as a small cake; 60 is a full display crown."
                onChange={setStreakCount}
              />
            ) : null}
            <SliderField
              label="Burst size"
              min={0.5}
              max={12}
              step={0.1}
              value={round2(rangeMid(design.burst.speed))}
              disabled={disabled}
              hint="How far the streaks fly from the centre. 2.5 is garden-size, 4.8 is a wide display sphere, 8+ is an extra-wide crown."
              onChange={(value) => setBurstRangeMid('speed', value, BROCADE_SPEED_HALF_WIDTH)}
            />
            <SliderField
              label="Hang time"
              min={0.5}
              max={8}
              step={0.1}
              value={round2(rangeMid(design.burst.life))}
              formatValue={formatSeconds}
              disabled={disabled}
              hint="How long the streak heads burn before fading. Trails always melt away just before their head does."
              onChange={(value) => setBurstRangeMid('life', value, BROCADE_LIFE_HALF_WIDTH)}
            />
            <SliderField
              label="Floatiness"
              min={-1.85}
              max={0}
              step={0.01}
              value={round2(rangeUpper(design.burst.gravity))}
              disabled={disabled}
              hint="0 keeps the stars almost perfectly flat; more negative values let them sink faster after the burst."
              onChange={setBrocadeGravityUpper}
            />
          </div>
        </PanelSection>

        {showLaunch ? (
          <PanelSection title="Launch">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {renderLiftVelocityControl(
                'Launch speed, which sets the burst height. 15 is the normal preset.',
              )}
              <SliderField
                label="Smoke particles"
                min={0}
                max={500}
                step={10}
                value={design.mortar.smokeParticles}
                disabled={disabled}
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
                  disabled={disabled}
                />
              </Field>
            </div>
          </PanelSection>
        ) : null}

        {renderBurstTrailControls()}

        <PanelSection
          title="Heads"
          collapsible
          defaultExpanded={headsEnabled}
          inactive={!headsEnabled}
          titleAccessory={
            <InfoTooltip text="Turn the glowing head orbs off to leave just the trails." />
          }
          action={
            <Switch
              id={headsToggleId}
              aria-label="Show heads"
              checked={headsEnabled}
              onCheckedChange={(value) => setBrocadeValue('headsEnabled', value)}
              disabled={disabled}
            />
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Head size"
                min={100}
                max={4000}
                step={50}
                value={design.brocade.headSize}
                disabled={sectionDisabled.heads}
                hint="Size budget for each glowing head. 900 matches a display shell; heads always stay bigger than their trail squares when you zoom in."
                onChange={(value) => setBrocadeValue('headSize', value)}
              />
              <SliderField
                label="Glow strength"
                min={0}
                max={3}
                step={0.05}
                value={design.brocade.glowStrength}
                disabled={sectionDisabled.heads}
                hint="Halo brightness around each head, and how strongly the burst tints the ground light. 0 is a bare core, 1 is standard, 2+ matches the exemplar bloom."
                onChange={(value) => setBrocadeValue('glowStrength', round2(value))}
              />
            </div>
            {renderStarAppearance(sectionDisabled.heads)}
          </div>
        </PanelSection>
      </>
    );
  }

  return (
    <>
      <PanelSection title="Burst">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {showStarCount ? (
            <SliderField
              label="Star count"
              min={STAR_COUNT_MIN}
              max={STAR_COUNT_MAX}
              step={1}
              value={Math.min(STAR_COUNT_MAX, Math.max(STAR_COUNT_MIN, Math.round(design.size)))}
              disabled={disabled}
              hint="How many stars the shell breaks into. Small shells can use a single star; fuller shells are capped at 100 for a clean preview."
              onChange={setStarCount}
            />
          ) : null}
          <SliderField
            label="Burst size"
            min={0.5}
            max={12}
            step={0.1}
            value={round2(rangeMid(design.burst.speed))}
            disabled={disabled}
            hint="How far the stars fly from the centre. 2.5 is garden-size; 4.5 is a wide display sphere."
            onChange={(value) => setBurstRangeMid('speed', value, BROCADE_SPEED_HALF_WIDTH)}
          />
          <SliderField
            label="Hang time"
            min={0.5}
            max={8}
            step={0.1}
            value={round2(rangeMid(design.burst.life))}
            formatValue={formatSeconds}
            disabled={disabled}
            hint="How long the stars burn before fading. Willow and horsetail hang longest."
            onChange={(value) => setBurstRangeMid('life', value, BROCADE_LIFE_HALF_WIDTH)}
          />
          <SliderField
            label="Floatiness"
            min={-1.85}
            max={0}
            step={0.01}
            value={round2(rangeUpper(design.burst.gravity))}
            disabled={disabled}
            hint="0 keeps the stars almost perfectly flat; more negative values let them sink faster after the burst."
            onChange={setBrocadeGravityUpper}
          />
        </div>
      </PanelSection>

      {showLaunch ? (
        <PanelSection title="Launch">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {renderLiftVelocityControl(
              'Launch speed, which sets the burst height. Small keeps effects low; High throws them taller.',
            )}
            <SliderField
              label="Smoke particles"
              min={0}
              max={500}
              step={10}
              value={design.mortar.smokeParticles}
              disabled={disabled}
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
                disabled={disabled}
              />
            </Field>
          </div>
        </PanelSection>
      ) : null}

      <PanelSection
        title="Stars"
        collapsible
        defaultExpanded={starsEnabled}
        inactive={!starsEnabled}
        titleAccessory={
          <InfoTooltip text="Show or hide the burst star heads. Trails can still render when star heads are hidden." />
        }
        action={
          <Switch
            id={headsToggleId}
            aria-label="Show stars"
            checked={starsEnabled}
            onCheckedChange={(value) => setStarsValue('heads', 'enabled', value)}
            disabled={disabled}
          />
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <SliderField
              label="Star size"
              min={STAR_SIZE_MIN}
              max={STAR_SIZE_MAX}
              step={STAR_SIZE_STEP}
              value={design.stars.heads.size}
              disabled={sectionDisabled.stars}
              hint="Size budget for each glowing star. 250 reads as a classic display star; comets sit near 900."
              onChange={(value) => setStarsValue('heads', 'size', value)}
            />
            <SliderField
              label="Glow strength"
              min={0}
              max={3}
              step={0.05}
              value={design.stars.heads.glowStrength}
              disabled={sectionDisabled.stars}
              hint="Halo brightness around each star. 0 is a bare core, 1 is standard, 2+ is full display bloom."
              onChange={(value) => setStarsValue('heads', 'glowStrength', round2(value))}
            />
          </div>
          {renderStarAppearance(sectionDisabled.stars)}
        </div>
      </PanelSection>

      {renderBurstTrailControls()}

      <PanelSection
        title="Strobe"
        collapsible
        defaultExpanded={strobeEnabled}
        inactive={!strobeEnabled}
        titleAccessory={<InfoTooltip text="Stars blink rapidly instead of burning steadily." />}
        action={
          <Switch
            id={strobeToggleId}
            aria-label="Strobe"
            checked={strobeEnabled}
            onCheckedChange={(value) => setNestedRenderValue('strobe', 'enabled', value)}
            disabled={disabled}
          />
        }
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <SliderField
            label="Blink rate"
            min={2}
            max={28}
            step={0.5}
            value={design.strobe.frequencyHz}
            disabled={sectionDisabled.strobe}
            hint="Flashes per second."
            onChange={(value) => setNestedRenderValue('strobe', 'frequencyHz', value)}
          />
          <SliderField
            label="Blink duty"
            min={0.1}
            max={0.9}
            step={0.05}
            value={design.strobe.dutyCycle}
            disabled={sectionDisabled.strobe}
            hint="Fraction of each blink the star spends lit."
            onChange={(value) => setNestedRenderValue('strobe', 'dutyCycle', round2(value))}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Crackle"
        collapsible
        defaultExpanded={crackleEnabled}
        inactive={!crackleEnabled}
        titleAccessory={
          <InfoTooltip text="Stars pop into crackling silver fragments as they die." />
        }
        action={
          <Switch
            id={crackleToggleId}
            aria-label="Crackle"
            checked={crackleEnabled}
            onCheckedChange={(value) => setNestedRenderValue('crackle', 'enabled', value)}
            disabled={disabled}
          />
        }
      >
        <SliderField
          label="Crackle probability"
          min={0}
          max={1}
          step={0.01}
          value={design.crackle.probability}
          disabled={sectionDisabled.crackle}
          hint="Per-frame chance a dying star pops. 0.05 is a gentle fizz; 0.3 is a full dragon-egg cloud."
          onChange={(value) => setNestedRenderValue('crackle', 'probability', round2(value))}
        />
      </PanelSection>

      {showSplitControls ? (
        <PanelSection title="Split">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <SliderField
              label="Split fragments"
              min={2}
              max={8}
              step={1}
              value={design.split.fragments}
              disabled={disabled}
              hint="How many pieces each crossette star splits into."
              onChange={(value) => setNestedRenderValue('split', 'fragments', value)}
            />
            <SliderField
              label="Split speed"
              min={0.4}
              max={4}
              step={0.05}
              value={design.split.speed}
              disabled={disabled}
              hint="How hard the fragments kick away from the split."
              onChange={(value) => setNestedRenderValue('split', 'speed', round2(value))}
            />
          </div>
        </PanelSection>
      ) : null}

      {showPistilControls ? (
        <PanelSection title="Pistil">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <SliderField
              label="Pistil size"
              min={0.1}
              max={0.9}
              step={0.02}
              value={design.pistil.sizeRatio}
              disabled={disabled}
              hint="Core star count relative to the outer petals."
              onChange={(value) => setNestedRenderValue('pistil', 'sizeRatio', round2(value))}
            />
            <SliderField
              label="Pistil speed"
              min={0.1}
              max={0.9}
              step={0.02}
              value={design.pistil.speedRatio}
              disabled={disabled}
              hint="Core burst speed relative to the outer petals."
              onChange={(value) => setNestedRenderValue('pistil', 'speedRatio', round2(value))}
            />
          </div>
        </PanelSection>
      ) : null}
    </>
  );
}
