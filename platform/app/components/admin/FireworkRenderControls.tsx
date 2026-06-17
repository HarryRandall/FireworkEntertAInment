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
import { ColorField } from '@/app/components/admin/ColorField';
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
  type BurstTrailPreset,
  type FireworkDesign,
  type FireworkStarLayer,
  type StarLayerKey,
} from '@/lib/fireworks/design';
import { cn } from '@/lib/utils';
import {
  DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF,
  DEFAULT_BACKGROUND_GLOW_SOFTNESS,
  DEFAULT_CORE_BRIGHTNESS,
  DEFAULT_CORE_OPACITY_FALLOFF,
  DEFAULT_CORE_SOFTNESS,
  DEFAULT_GLOW_BLUR,
  DEFAULT_GLOW_OPACITY_FALLOFF,
  DEFAULT_GLOW_PADDING,
  DEFAULT_GLOW_SIZE,
  DEFAULT_GLOW_SOFTNESS,
  DEFAULT_HEAD_GLOW_STRENGTH,
  DEFAULT_WHITE_CORE_BLUR_PERCENT,
  DEFAULT_WHITE_CORE_SIZE_PERCENT,
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
  MAX_HEAD_GLOW_STRENGTH,
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
  MIN_HEAD_GLOW_STRENGTH,
  MIN_WHITE_CORE_BLUR_PERCENT,
  MIN_WHITE_CORE_SIZE_PERCENT,
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
const TRAIL_PARTICLE_SCALE_MAX = 4;
const TRAIL_SPREAD_ANGLE_MAX = 60;
const TRAIL_BIAS_MIN = -100;
const TRAIL_BIAS_MAX = 100;
const TRAIL_HEAD_GAP_MAX = 300;
const TRAIL_SPACING_CURVE_MIN = 0.2;
const TRAIL_SPACING_CURVE_MAX = 4;
const TRAIL_ROTATION_MAX = 8;
const LIFT_PARTICLE_AMOUNT_MAX = 240;
const LIFT_PARTICLE_SIZE_MAX = 180;
const LIFT_PARTICLE_HEIGHT_MAX = 900;
const LAUNCH_SMOKE_PARTICLES_MAX = 500;
const LAUNCH_SMOKE_SIZE_MAX = 220;
const LAUNCH_SMOKE_SPREAD_MAX = 140;
const LAUNCH_SMOKE_DRIFT_MAX = 4;
const LAUNCH_SMOKE_HEIGHT_MAX = 900;
const CALIBRATED_APPEARANCE_MIN = 0;
const CALIBRATED_APPEARANCE_DEFAULT = 50;
const CALIBRATED_APPEARANCE_MAX = 100;
const CALIBRATED_APPEARANCE_STEP = 1;

const HEAD_GLOW_STRENGTH_RANGE = {
  min: MIN_HEAD_GLOW_STRENGTH,
  defaultValue: DEFAULT_HEAD_GLOW_STRENGTH,
  max: MAX_HEAD_GLOW_STRENGTH,
};
const CORE_SOFTNESS_RANGE = {
  min: MIN_CORE_SOFTNESS,
  defaultValue: DEFAULT_CORE_SOFTNESS,
  max: MAX_CORE_SOFTNESS,
};
const CORE_BRIGHTNESS_RANGE = {
  min: MIN_CORE_BRIGHTNESS,
  defaultValue: DEFAULT_CORE_BRIGHTNESS,
  max: MAX_CORE_BRIGHTNESS,
};
const WHITE_CORE_SIZE_RANGE = {
  min: MIN_WHITE_CORE_SIZE_PERCENT,
  defaultValue: DEFAULT_WHITE_CORE_SIZE_PERCENT,
  max: MAX_WHITE_CORE_SIZE_PERCENT,
};
const WHITE_CORE_BLUR_RANGE = {
  min: MIN_WHITE_CORE_BLUR_PERCENT,
  defaultValue: DEFAULT_WHITE_CORE_BLUR_PERCENT,
  max: MAX_WHITE_CORE_BLUR_PERCENT,
};
const CORE_OPACITY_RANGE = {
  min: MIN_CORE_OPACITY_FALLOFF,
  defaultValue: DEFAULT_CORE_OPACITY_FALLOFF,
  max: MAX_CORE_OPACITY_FALLOFF,
};
const GLOW_SIZE_RANGE = {
  min: MIN_GLOW_SIZE,
  defaultValue: DEFAULT_GLOW_SIZE,
  max: MAX_GLOW_SIZE,
};
const GLOW_SOFTNESS_RANGE = {
  min: MIN_GLOW_SOFTNESS,
  defaultValue: DEFAULT_GLOW_SOFTNESS,
  max: MAX_GLOW_SOFTNESS,
};
const GLOW_OPACITY_RANGE = {
  min: MIN_GLOW_OPACITY_FALLOFF,
  defaultValue: DEFAULT_GLOW_OPACITY_FALLOFF,
  max: MAX_GLOW_OPACITY_FALLOFF,
};
const BACKGROUND_GLOW_SIZE_RANGE = {
  min: MIN_GLOW_PADDING,
  defaultValue: DEFAULT_GLOW_PADDING,
  max: MAX_GLOW_PADDING,
};
const BACKGROUND_GLOW_STRENGTH_RANGE = {
  min: MIN_GLOW_BLUR,
  defaultValue: DEFAULT_GLOW_BLUR,
  max: MAX_GLOW_BLUR,
};
const BACKGROUND_GLOW_SOFTNESS_RANGE = {
  min: MIN_BACKGROUND_GLOW_SOFTNESS,
  defaultValue: DEFAULT_BACKGROUND_GLOW_SOFTNESS,
  max: MAX_BACKGROUND_GLOW_SOFTNESS,
};
const BACKGROUND_GLOW_OPACITY_RANGE = {
  min: MIN_BACKGROUND_GLOW_OPACITY_FALLOFF,
  defaultValue: DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF,
  max: MAX_BACKGROUND_GLOW_OPACITY_FALLOFF,
};

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

function formatDegrees(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} deg`;
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}x`;
}

function formatRotation(value: number): string {
  if (value <= 0) return 'Off';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}x`;
}

function trailBiasFromFrontClump(frontClump: number): number {
  return round2((frontClump - 0.5) * 200);
}

function frontClumpFromTrailBias(value: number): number {
  return round2((value - TRAIL_BIAS_MIN) / (TRAIL_BIAS_MAX - TRAIL_BIAS_MIN));
}

function formatTrailBias(value: number): string {
  if (Math.abs(value) < 1) return 'Even';
  return value > 0 ? `Head ${Math.round(value)}%` : `Tail ${Math.round(Math.abs(value))}%`;
}

function hexToRgbObject(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const int = Number.parseInt(clean, 16);
  return {
    r: ((int >> 16) & 0xff) / 255,
    g: ((int >> 8) & 0xff) / 255,
    b: (int & 0xff) / 255,
  };
}

function rgbObjectToHex(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const r = Number(value.r);
  const g = Number(value.g);
  const b = Number(value.b);
  if (![r, g, b].every(Number.isFinite)) return null;
  const toByte = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * 255)));
  return `#${[toByte(r), toByte(g), toByte(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

type CalibratedRange = {
  min: number;
  defaultValue: number;
  max: number;
};

function withCalibrationDefault(range: CalibratedRange, value: unknown): CalibratedRange {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return range;
  return {
    ...range,
    defaultValue: Math.min(range.max, Math.max(range.min, raw)),
  };
}

function rawToCalibrated(value: number, range: CalibratedRange): number {
  const bounded = Math.min(range.max, Math.max(range.min, value));
  if (bounded <= range.defaultValue) {
    const lowerSpan = range.defaultValue - range.min;
    return lowerSpan <= 0
      ? CALIBRATED_APPEARANCE_DEFAULT
      : round2(((bounded - range.min) / lowerSpan) * CALIBRATED_APPEARANCE_DEFAULT);
  }

  const upperSpan = range.max - range.defaultValue;
  return upperSpan <= 0
    ? CALIBRATED_APPEARANCE_DEFAULT
    : round2(
        CALIBRATED_APPEARANCE_DEFAULT +
          ((bounded - range.defaultValue) / upperSpan) * CALIBRATED_APPEARANCE_DEFAULT,
      );
}

function calibratedToRaw(value: number, range: CalibratedRange): number {
  const bounded = Math.min(CALIBRATED_APPEARANCE_MAX, Math.max(CALIBRATED_APPEARANCE_MIN, value));

  if (bounded <= CALIBRATED_APPEARANCE_DEFAULT) {
    return round2(
      range.min + (bounded / CALIBRATED_APPEARANCE_DEFAULT) * (range.defaultValue - range.min),
    );
  }

  return round2(
    range.defaultValue +
      ((bounded - CALIBRATED_APPEARANCE_DEFAULT) / CALIBRATED_APPEARANCE_DEFAULT) *
        (range.max - range.defaultValue),
  );
}

function CalibratedSliderField({
  label,
  value,
  range,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  range: CalibratedRange;
  disabled?: boolean;
  hint: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <SliderField
      label={label}
      min={CALIBRATED_APPEARANCE_MIN}
      max={CALIBRATED_APPEARANCE_MAX}
      step={CALIBRATED_APPEARANCE_STEP}
      value={rawToCalibrated(value, range)}
      formatValue={formatPercent}
      disabled={disabled}
      hint={hint}
      onChange={(next) => onChange(calibratedToRaw(next, range))}
    />
  );
}

function liftVelocityPresetMode(value: number): LiftVelocityMode {
  const rounded = round2(value);
  const preset = LIFT_VELOCITY_OPTIONS.find(
    (option) => option.velocity != null && option.velocity === rounded,
  );
  return preset?.value ?? 'custom';
}

type BurstTrail = FireworkStarLayer['burstTrail'];
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
  return shapeOptionFromWeights(weights);
}

function shapeOptionFromWeights(weights: BurstTrailStop['shapeWeights']): TrailParticleShapeOption {
  if (weights.circle >= 99.5 && weights.square <= 0.5 && weights.triangle <= 0.5) return 'circle';
  if (weights.triangle >= 99.5 && weights.circle <= 0.5 && weights.square <= 0.5) {
    return 'triangle';
  }
  if (weights.square >= 99.5 && weights.circle <= 0.5 && weights.triangle <= 0.5) return 'square';
  return 'mixed';
}

export function PanelSection({
  title,
  titleAccessory,
  action,
  collapsible = false,
  defaultExpanded = false,
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
export function SubSection({
  title,
  action,
  defaultExpanded = false,
  children,
}: {
  title: string;
  action?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)]">
      <div className="relative">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          className="focus-visible:ring-ring/50 flex min-h-14 w-full items-center gap-2 px-3 text-left transition-colors outline-none hover:bg-[color:var(--color-bg-surface)] focus-visible:ring-2"
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
        {action ? (
          <div className="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 items-center">
            {action}
          </div>
        ) : null}
      </div>
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
  /**
   * Saved base settings used as the 50% point for calibrated appearance sliders.
   * If absent, the controls fall back to their renderer-safe defaults.
   */
  calibrationDefaults?: JsonRecord;
  mutate: (updater: (defaults: JsonRecord) => void) => void;
  disabled?: boolean;
  /** Content to render directly after the required Burst section. */
  afterBurst?: ReactNode;
  /** Optional firework colour controls shown inside the primary Star section. */
  starControls?: ReactNode;
  /** Show the lift-particle and smoke launch-visual panels. Firework-level. */
  showLaunch?: boolean;
  /** Show the star / streak count controls. Firework-level. */
  showStarCount?: boolean;
};

export function FireworkRenderControls({
  design,
  defaults,
  calibrationDefaults,
  mutate,
  disabled = false,
  afterBurst,
  starControls,
  showLaunch = false,
  showStarCount = false,
}: RenderControlsProps) {
  const outerTrailsToggleId = useId();
  const coreTrailsToggleId = useId();
  const headsToggleId = useId();
  const outerToggleId = useId();
  const coreToggleId = useId();
  const liftParticlesToggleId = useId();
  const smokeToggleId = useId();
  const strobeToggleId = useId();
  const crackleToggleId = useId();
  const splitToggleId = useId();
  const [forceCustomLiftVelocity, setForceCustomLiftVelocity] = useState(false);

  const strobeDefaults = readRecord(defaults, 'strobe');
  const crackleDefaults = readRecord(defaults, 'crackle');
  const soundDefaults = readRecord(defaults, 'sound');
  const calibrationSource = calibrationDefaults ?? defaults;
  const calibrationStarsRecord = readRecord(calibrationSource, 'stars');
  const calibrationStars =
    Object.keys(readRecord(readRecord(calibrationStarsRecord, 'outer'), 'head')).length > 0
      ? readRecord(readRecord(calibrationStarsRecord, 'outer'), 'head')
      : readRecord(calibrationStarsRecord, 'heads');
  const calibrationBrocade = readRecord(calibrationSource, 'brocade');
  const headGlowStrengthRange = withCalibrationDefault(
    HEAD_GLOW_STRENGTH_RANGE,
    calibrationStars.glowStrength,
  );
  const brocadeGlowStrengthRange = withCalibrationDefault(
    HEAD_GLOW_STRENGTH_RANGE,
    calibrationBrocade.glowStrength,
  );
  const coreSoftnessRange = withCalibrationDefault(
    CORE_SOFTNESS_RANGE,
    calibrationStars.coreSoftness,
  );
  const coreBrightnessRange = withCalibrationDefault(
    CORE_BRIGHTNESS_RANGE,
    calibrationStars.coreBrightness,
  );
  const whiteCoreSizeRange = withCalibrationDefault(
    WHITE_CORE_SIZE_RANGE,
    calibrationStars.whiteCoreSizePercent,
  );
  const whiteCoreBlurRange = withCalibrationDefault(
    WHITE_CORE_BLUR_RANGE,
    calibrationStars.whiteCoreBlurPercent,
  );
  const coreOpacityRange = withCalibrationDefault(
    CORE_OPACITY_RANGE,
    calibrationStars.coreOpacityFalloff,
  );
  const glowSizeRange = withCalibrationDefault(GLOW_SIZE_RANGE, calibrationStars.glowSize);
  const glowSoftnessRange = withCalibrationDefault(
    GLOW_SOFTNESS_RANGE,
    calibrationStars.glowSoftness,
  );
  const glowOpacityRange = withCalibrationDefault(
    GLOW_OPACITY_RANGE,
    calibrationStars.glowOpacityFalloff,
  );
  const backgroundGlowSizeRange = withCalibrationDefault(
    BACKGROUND_GLOW_SIZE_RANGE,
    calibrationStars.glowPadding,
  );
  const backgroundGlowStrengthRange = withCalibrationDefault(
    BACKGROUND_GLOW_STRENGTH_RANGE,
    calibrationStars.glowBlur,
  );
  const backgroundGlowSoftnessRange = withCalibrationDefault(
    BACKGROUND_GLOW_SOFTNESS_RANGE,
    calibrationStars.backgroundGlowSoftness,
  );
  const backgroundGlowOpacityRange = withCalibrationDefault(
    BACKGROUND_GLOW_OPACITY_RANGE,
    calibrationStars.backgroundGlowOpacityFalloff,
  );

  const isBrocade = design.geometry === 'crown' && design.trailProfile === 'glitter';
  const headsEnabled = design.brocade.headsEnabled;
  const outerEnabled = design.stars.outer.enabled;
  const coreEnabled = design.stars.core.enabled;
  const strobeEnabled =
    typeof strobeDefaults.enabled === 'boolean' ? strobeDefaults.enabled : design.strobe.enabled;
  const crackleEnabled =
    typeof crackleDefaults.enabled === 'boolean' ? crackleDefaults.enabled : design.crackle.enabled;
  const liftParticlesEnabled = design.launch.liftParticles.enabled;
  const smokeEnabled = design.launch.smoke.enabled;
  const showSplitControls = design.split.enabled || design.geometry === 'split_cross';
  const boomValue = BOOM_OPTIONS.some((option) => option.value === soundDefaults.boom)
    ? (soundDefaults.boom as string)
    : design.sound.boom;
  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  const sectionDisabled = {
    liftParticles: disabled || !liftParticlesEnabled,
    smoke: disabled || !smokeEnabled,
    heads: disabled || !headsEnabled,
    outer: disabled || !outerEnabled,
    core: disabled || !coreEnabled,
    strobe: disabled || !strobeEnabled,
    crackle: disabled || !crackleEnabled,
    split: disabled || !design.split.enabled,
  };

  function setRenderValue(key: string, value: unknown) {
    mutate((draft) => {
      draft[key] = value;
    });
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

  function setLaunchValue<T extends keyof FireworkDesign['launch']>(
    section: T,
    key: keyof FireworkDesign['launch'][T],
    value: unknown,
  ) {
    mutate((draft) => {
      const launch = ensureRecord(draft, 'launch');
      const target = ensureRecord(launch, String(section));
      target[String(key)] = value;
    });
  }

  function setLaunchNestedValue(
    section: keyof FireworkDesign['launch'],
    group: string,
    key: string,
    value: unknown,
  ) {
    mutate((draft) => {
      const launch = ensureRecord(draft, 'launch');
      const target = ensureRecord(launch, String(section));
      const nested = ensureRecord(target, group);
      nested[key] = value;
    });
  }

  function renderBoomControl() {
    return (
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
    );
  }

  function renderLiftParticleControls() {
    if (!showLaunch) return null;

    const liftParticles = design.launch.liftParticles;
    const controlDisabled = sectionDisabled.liftParticles;
    const particleShape = shapeOptionFromWeights(liftParticles.shapeWeights);
    const liftBias = trailBiasFromFrontClump(liftParticles.frontClump);

    function setParticleShape(value: string) {
      const shape = value as TrailParticleShapeOption;
      const weights = TRAIL_PARTICLE_SHAPE_WEIGHTS[shape] ?? TRAIL_PARTICLE_SHAPE_WEIGHTS.square;
      setLaunchValue('liftParticles', 'shapeWeights', { ...weights });
    }

    return (
      <PanelSection
        title="Lift particles"
        collapsible
        defaultExpanded={false}
        inactive={!liftParticlesEnabled}
        titleAccessory={<InfoTooltip text="Glowing ascent particles that climb with the shell." />}
        action={
          <Switch
            id={liftParticlesToggleId}
            aria-label="Lift particles"
            checked={liftParticlesEnabled}
            onCheckedChange={(value) => setLaunchValue('liftParticles', 'enabled', value)}
            disabled={disabled}
          />
        }
      >
        <div className="space-y-4">
          <SubSection title="Particles">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Amount"
                min={0}
                max={LIFT_PARTICLE_AMOUNT_MAX}
                step={1}
                value={liftParticles.amount}
                showNumberInput
                inputAriaLabel="Lift particle amount value"
                disabled={controlDisabled}
                hint="How many glowing particles climb with the shell before the burst."
                onChange={(value) => setLaunchValue('liftParticles', 'amount', Math.round(value))}
              />
              <ColorField
                label="Colour"
                value={rgbObjectToHex(liftParticles.colour)}
                allowClear
                disabled={controlDisabled}
                hint="Leave clear to inherit the firework's main lift colour."
                onChange={(value) =>
                  setLaunchValue(
                    'liftParticles',
                    'colour',
                    value ? hexToRgbObject(value) : undefined,
                  )
                }
              />
              <Field>
                <div className="flex items-center gap-1.5">
                  <FieldLabel>Particle shape</FieldLabel>
                  <InfoTooltip text="Shape of every lift particle: square sparks, glowing discs, triangles, or a mix." />
                </div>
                <SelectField
                  value={particleShape}
                  onChange={setParticleShape}
                  options={[...TRAIL_PARTICLE_SHAPE_OPTIONS]}
                  ariaLabel="Lift particle shape"
                  disabled={controlDisabled}
                />
              </Field>
              <SliderField
                label="Particle size"
                min={1}
                max={LIFT_PARTICLE_SIZE_MAX}
                step={1}
                value={liftParticles.particleSize.base}
                showNumberInput
                inputAriaLabel="Lift particle size value"
                disabled={controlDisabled}
                hint="Global size for every lift particle before head and tail scaling."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'particleSize', 'base', round2(value))
                }
              />
              <SliderField
                label="Head scale"
                min={0}
                max={TRAIL_PARTICLE_SCALE_MAX}
                step={0.05}
                value={liftParticles.particleSize.headScale}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift head scale value"
                disabled={controlDisabled}
                hint="Size multiplier when each particle first appears near the rising shell."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'particleSize', 'headScale', round2(value))
                }
              />
              <SliderField
                label="Tail scale"
                min={0}
                max={TRAIL_PARTICLE_SCALE_MAX}
                step={0.05}
                value={liftParticles.particleSize.tailScale}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift tail scale value"
                disabled={controlDisabled}
                hint="Size multiplier as each particle ages into the lift tail."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'particleSize', 'tailScale', round2(value))
                }
              />
              <SliderField
                label="Size random"
                min={0}
                max={100}
                step={1}
                value={liftParticles.particleSize.variationPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift size random value"
                disabled={controlDisabled}
                hint="Seeded size variation so the lift trail does not look uniform."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'particleSize',
                    'variationPercent',
                    round2(value),
                  )
                }
              />
              <SliderField
                label="Rotation"
                min={0}
                max={TRAIL_ROTATION_MAX}
                step={0.1}
                value={liftParticles.motion.spin}
                formatValue={formatRotation}
                showNumberInput
                inputAriaLabel="Lift rotation value"
                disabled={controlDisabled}
                hint="0 keeps every particle locked in place. Higher values spin particles as they fade."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'spin', round2(value))
                }
              />
            </div>
          </SubSection>

          <SubSection title="Placement">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Head-tail balance"
                min={TRAIL_BIAS_MIN}
                max={TRAIL_BIAS_MAX}
                step={1}
                value={liftBias}
                formatValue={formatTrailBias}
                disabled={controlDisabled}
                hint="Where the lift particle budget lands along the ascent path."
                onChange={(value) =>
                  setLaunchValue('liftParticles', 'frontClump', frontClumpFromTrailBias(value))
                }
              />
              <SliderField
                label="Spacing curve"
                min={TRAIL_SPACING_CURVE_MIN}
                max={TRAIL_SPACING_CURVE_MAX}
                step={0.05}
                value={liftParticles.spacing.curve}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift spacing curve value"
                disabled={controlDisabled}
                hint="Curves where particles are spent along the launch path."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'spacing', 'curve', round2(value))
                }
              />
              <SliderField
                label="Gap random"
                min={0}
                max={100}
                step={1}
                value={liftParticles.spacing.jitterPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift gap random value"
                disabled={controlDisabled}
                hint="Seeded irregularity in lift-particle spacing."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'spacing', 'jitterPercent', round2(value))
                }
              />
              <SliderField
                label="Spread"
                min={0}
                max={90}
                step={1}
                value={liftParticles.spread}
                disabled={controlDisabled}
                hint="How wide the rising particles scatter around the shell path."
                onChange={(value) => setLaunchValue('liftParticles', 'spread', round2(value))}
              />
              <SliderField
                label="Max height"
                min={0}
                max={LIFT_PARTICLE_HEIGHT_MAX}
                step={10}
                value={liftParticles.height}
                showNumberInput
                inputAriaLabel="Lift max height value"
                disabled={controlDisabled}
                hint="The height where glowing lift particles stop being emitted."
                onChange={(value) => setLaunchValue('liftParticles', 'height', round2(value))}
              />
            </div>
          </SubSection>

          <SubSection title="Life and glow">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Particle life"
                min={0.1}
                max={8}
                step={0.1}
                value={liftParticles.lifetime.baseSeconds}
                formatValue={formatSeconds}
                showNumberInput
                inputAriaLabel="Lift particle life value"
                disabled={controlDisabled}
                hint="How long each lift particle remains visible."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'lifetime', 'baseSeconds', round2(value))
                }
              />
              <SliderField
                label="Life random"
                min={0}
                max={100}
                step={1}
                value={liftParticles.lifetime.variationPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift life random value"
                disabled={controlDisabled}
                hint="Seeded variation in each particle's lifetime."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'lifetime',
                    'variationPercent',
                    round2(value),
                  )
                }
              />
              <SliderField
                label="Afterglow"
                min={0}
                max={6}
                step={0.05}
                value={liftParticles.lifetime.afterglowSeconds}
                formatValue={formatSeconds}
                showNumberInput
                inputAriaLabel="Lift afterglow value"
                disabled={controlDisabled}
                hint="Extra glow time added after the main particle life."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'lifetime',
                    'afterglowSeconds',
                    round2(value),
                  )
                }
              />
              <SliderField
                label="Brightness"
                min={0}
                max={3}
                step={0.05}
                value={liftParticles.intensity.brightness}
                showNumberInput
                inputAriaLabel="Lift brightness value"
                disabled={controlDisabled}
                hint="How brightly the lift particles burn."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'intensity', 'brightness', round2(value))
                }
              />
              <SliderField
                label="Fade softness"
                min={0.2}
                max={4}
                step={0.05}
                value={liftParticles.intensity.fadeSoftness}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift fade softness value"
                disabled={controlDisabled}
                hint="How gently lift particles cool into their tail."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'intensity', 'fadeSoftness', round2(value))
                }
              />
              <SliderField
                label="Flicker"
                min={0}
                max={1}
                step={0.01}
                value={liftParticles.flicker.chance}
                disabled={controlDisabled}
                hint="Chance each lift particle twinkles white-hot."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'flicker', 'chance', round2(value))
                }
              />
            </div>
          </SubSection>

          <SubSection title="Motion">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Gravity"
                min={-2}
                max={1}
                step={0.01}
                value={liftParticles.motion.gravity}
                showNumberInput
                inputAriaLabel="Lift gravity value"
                disabled={controlDisabled}
                hint="Vertical pull on lift particles after they spawn."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'gravity', round2(value))
                }
              />
              <SliderField
                label="Drag"
                min={0}
                max={6}
                step={0.05}
                value={liftParticles.motion.drag}
                showNumberInput
                inputAriaLabel="Lift drag value"
                disabled={controlDisabled}
                hint="Air resistance applied to lift particles."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'drag', round2(value))
                }
              />
              <SliderField
                label="Inherit speed"
                min={0}
                max={1}
                step={0.01}
                value={liftParticles.motion.inheritedVelocity}
                showNumberInput
                inputAriaLabel="Lift inherited speed value"
                disabled={controlDisabled}
                hint="How much of the shell's current velocity the lift particles inherit."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'motion',
                    'inheritedVelocity',
                    round2(value),
                  )
                }
              />
              <SliderField
                label="Turbulence"
                min={0}
                max={2}
                step={0.01}
                value={liftParticles.motion.turbulence}
                showNumberInput
                inputAriaLabel="Lift turbulence value"
                disabled={controlDisabled}
                hint="Random movement added to lift particles."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'turbulence', round2(value))
                }
              />
              <SliderField
                label="Side drift"
                min={-2}
                max={2}
                step={0.01}
                value={liftParticles.motion.driftX}
                showNumberInput
                inputAriaLabel="Lift side drift value"
                disabled={controlDisabled}
                hint="Left-right drift applied to lift particles."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'driftX', round2(value))
                }
              />
              <SliderField
                label="Vertical drift"
                min={-2}
                max={2}
                step={0.01}
                value={liftParticles.motion.driftY}
                showNumberInput
                inputAriaLabel="Lift vertical drift value"
                disabled={controlDisabled}
                hint="Extra vertical drift applied to lift particles."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'driftY', round2(value))
                }
              />
              <SliderField
                label="Forward drift"
                min={-2}
                max={2}
                step={0.01}
                value={liftParticles.motion.driftZ}
                showNumberInput
                inputAriaLabel="Lift forward drift value"
                disabled={controlDisabled}
                hint="Forward-back drift applied to lift particles."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'driftZ', round2(value))
                }
              />
            </div>
          </SubSection>
        </div>
      </PanelSection>
    );
  }

  function renderSmokeControls() {
    if (!showLaunch) return null;

    const smoke = design.launch.smoke;

    return (
      <PanelSection
        title="Smoke"
        collapsible
        defaultExpanded={false}
        inactive={!smokeEnabled}
        titleAccessory={<InfoTooltip text="Launch smoke from the mortar and rising shell path." />}
        action={
          <Switch
            id={smokeToggleId}
            aria-label="Smoke"
            checked={smokeEnabled}
            onCheckedChange={(value) => setLaunchValue('smoke', 'enabled', value)}
            disabled={disabled}
          />
        }
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <SliderField
            label="Smoke particles"
            min={0}
            max={LAUNCH_SMOKE_PARTICLES_MAX}
            step={10}
            value={smoke.particles}
            showNumberInput
            inputAriaLabel="Smoke particles value"
            disabled={sectionDisabled.smoke}
            hint="Smoke spawned at launch and mixed into the rising trail."
            onChange={(value) => setLaunchValue('smoke', 'particles', Math.round(value))}
          />
          <SliderField
            label="Smoke size"
            min={4}
            max={LAUNCH_SMOKE_SIZE_MAX}
            step={1}
            value={smoke.size}
            showNumberInput
            inputAriaLabel="Smoke size value"
            disabled={sectionDisabled.smoke}
            hint="Size of each smoke puff."
            onChange={(value) => setLaunchValue('smoke', 'size', round2(value))}
          />
          <SliderField
            label="Smoke life"
            min={0.2}
            max={12}
            step={0.1}
            value={smoke.lifeSeconds}
            formatValue={formatSeconds}
            showNumberInput
            inputAriaLabel="Smoke life value"
            disabled={sectionDisabled.smoke}
            hint="How long smoke remains visible before it fades."
            onChange={(value) => setLaunchValue('smoke', 'lifeSeconds', round2(value))}
          />
          <SliderField
            label="Smoke spread"
            min={0}
            max={LAUNCH_SMOKE_SPREAD_MAX}
            step={1}
            value={smoke.spread}
            showNumberInput
            inputAriaLabel="Smoke spread value"
            disabled={sectionDisabled.smoke}
            hint="How far smoke spreads from the launch point and shell path."
            onChange={(value) => setLaunchValue('smoke', 'spread', round2(value))}
          />
          <SliderField
            label="Smoke drift"
            min={0}
            max={LAUNCH_SMOKE_DRIFT_MAX}
            step={0.05}
            value={smoke.drift}
            formatValue={formatMultiplier}
            showNumberInput
            inputAriaLabel="Smoke drift value"
            disabled={sectionDisabled.smoke}
            hint="How much smoke curls sideways as it rises."
            onChange={(value) => setLaunchValue('smoke', 'drift', round2(value))}
          />
          <SliderField
            label="Rise height"
            min={0}
            max={LAUNCH_SMOKE_HEIGHT_MAX}
            step={10}
            value={smoke.height}
            showNumberInput
            inputAriaLabel="Smoke rise height value"
            disabled={sectionDisabled.smoke}
            hint="The height where rising smoke stops being emitted."
            onChange={(value) => setLaunchValue('smoke', 'height', round2(value))}
          />
        </div>
      </PanelSection>
    );
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

  function setLayerValue(layerKey: StarLayerKey, key: string, value: unknown) {
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const target = ensureRecord(stars, layerKey);
      target[key] = value;
    });
  }

  function setLayerNestedValue(
    layerKey: StarLayerKey,
    group: 'burst' | 'head',
    key: string,
    value: unknown,
  ) {
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      const target = ensureRecord(layer, group);
      target[key] = value;
    });
  }

  function setLayerBurstRangeMid(
    layerKey: StarLayerKey,
    key: 'speed' | 'gravity' | 'life',
    mid: number,
    halfWidth: number,
  ) {
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      const burst = ensureRecord(layer, 'burst');
      burst[key] = [round2(mid - halfWidth), round2(mid + halfWidth)];
    });
  }

  function setLayerGravityUpper(layerKey: StarLayerKey, maxGravity: number) {
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      const burst = ensureRecord(layer, 'burst');
      const upper = Math.min(0, maxGravity);
      burst.gravity = [round2(upper - BROCADE_GRAVITY_HALF_WIDTH), round2(upper)];
    });
  }

  /**
   * Full head-orb appearance controls, shared by star layers and the brocade
   * "Heads" panel. Star values are saved on the selected layer's `head` object
   * and feed the live preview through the editor's `headStyle` / `renderTuning`
   * props. Grouped into Core and Glow so the richer set stays readable.
   */
  function renderStarAppearance(
    layerKey: StarLayerKey,
    controlDisabled: boolean,
    leadingControls?: ReactNode,
  ) {
    const heads = design.stars[layerKey].head;
    return (
      <div className="space-y-2.5">
        {leadingControls}
        <SubSection title="Core">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <CalibratedSliderField
              label="Core blur"
              range={coreSoftnessRange}
              value={heads.coreSoftness}
              disabled={controlDisabled}
              hint="Blur through the coloured core. 0% is a hard-edged disc; higher diffuses the centre and edge into a soft orb."
              onChange={(value) => setLayerNestedValue(layerKey, 'head', 'coreSoftness', value)}
            />
            <CalibratedSliderField
              label="Brightness"
              range={coreBrightnessRange}
              value={heads.coreBrightness}
              disabled={controlDisabled}
              hint="How hot the coloured centre burns. Lower is calmer; higher pushes toward white."
              onChange={(value) => setLayerNestedValue(layerKey, 'head', 'coreBrightness', value)}
            />
            <CalibratedSliderField
              label="White dot size"
              range={whiteCoreSizeRange}
              value={heads.whiteCoreSizePercent}
              disabled={controlDisabled}
              hint="Size of the white-hot centre inside each star. Lower reduces the dot; higher grows it."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'whiteCoreSizePercent', value)
              }
            />
            <CalibratedSliderField
              label="White dot blur"
              range={whiteCoreBlurRange}
              value={heads.whiteCoreBlurPercent}
              disabled={controlDisabled}
              hint="Feathering on the white dot. 0% is crisp; higher softens it without making a tiny dot flood the whole core."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'whiteCoreBlurPercent', value)
              }
            />
            <CalibratedSliderField
              label="Core fade"
              range={coreOpacityRange}
              value={heads.coreOpacityFalloff}
              disabled={controlDisabled}
              hint="Opacity falloff for the coloured core. 0% keeps the edge solid; higher fades the core into the surrounding glow."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'coreOpacityFalloff', value)
              }
            />
          </div>
        </SubSection>
        <SubSection title="Glow">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <CalibratedSliderField
              label="Star glow radius"
              range={glowSizeRange}
              value={heads.glowSize}
              disabled={controlDisabled}
              hint="Size of the coloured bloom attached to the star itself. Low hugs the core; high spreads the close glow outward."
              onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowSize', value)}
            />
            <CalibratedSliderField
              label="Star glow blur"
              range={glowSoftnessRange}
              value={heads.glowSoftness}
              disabled={controlDisabled}
              hint="Blur of the close coloured glow. Low is tight and defined; high spreads it into a much softer bloom."
              onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowSoftness', value)}
            />
            <CalibratedSliderField
              label="Star glow fade"
              range={glowOpacityRange}
              value={heads.glowOpacityFalloff}
              disabled={controlDisabled}
              hint="Opacity falloff for the close star glow. Higher values fade it to transparent sooner, removing the outer ring."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'glowOpacityFalloff', value)
              }
            />
            <CalibratedSliderField
              label="Background glow size"
              range={backgroundGlowSizeRange}
              value={heads.glowPadding}
              disabled={controlDisabled}
              hint="Size of the large coloured wash behind each star. Lower keeps it tight; higher gives it more room to bloom."
              onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowPadding', value)}
            />
            <CalibratedSliderField
              label="Background glow strength"
              range={backgroundGlowStrengthRange}
              value={heads.glowBlur}
              disabled={controlDisabled}
              hint="Brightness of the large coloured wash behind each star. 0% removes it; higher stays coloured rather than turning the whole sprite white."
              onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowBlur', value)}
            />
            <CalibratedSliderField
              label="Background blur"
              range={backgroundGlowSoftnessRange}
              value={heads.backgroundGlowSoftness}
              disabled={controlDisabled}
              hint="Blur of the large background wash. Higher values make the glow much more diffused without changing the star size."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'backgroundGlowSoftness', value)
              }
            />
            <CalibratedSliderField
              label="Background fade"
              range={backgroundGlowOpacityRange}
              value={heads.backgroundGlowOpacityFalloff}
              disabled={controlDisabled}
              hint="Opacity falloff for the large background wash. Higher values fade the outside to nothing before it reaches the sprite edge."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'backgroundGlowOpacityFalloff', value)
              }
            />
          </div>
        </SubSection>
      </div>
    );
  }

  function currentBurstTrail(layerKey?: StarLayerKey): BurstTrail {
    return layerKey ? design.stars[layerKey].burstTrail : design.burstTrail;
  }

  function writeBurstTrail(layerKey: StarLayerKey | undefined, next: BurstTrail) {
    mutate((draft) => {
      if (!layerKey) {
        draft.burstTrail = next;
        return;
      }
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      layer.burstTrail = next;
    });
  }

  function setBurstTrailPreset(layerKey: StarLayerKey | undefined, preset: BurstTrailPreset) {
    writeBurstTrail(layerKey, makeBurstTrailPreset(preset));
  }

  function patchBurstTrail(
    layerKey: StarLayerKey | undefined,
    updater: (trail: BurstTrail) => BurstTrail,
    custom = true,
  ) {
    const current = cloneTrail(currentBurstTrail(layerKey));
    const next = updater(current);
    writeBurstTrail(layerKey, custom ? { ...next, preset: 'custom' } : next);
  }

  function setBurstTrailEnabled(layerKey: StarLayerKey | undefined, value: boolean) {
    patchBurstTrail(layerKey, (trail) => ({ ...trail, enabled: value }), false);
  }

  function setBurstTrailValue(
    layerKey: StarLayerKey | undefined,
    key: keyof BurstTrail,
    value: unknown,
  ) {
    patchBurstTrail(layerKey, (trail) => ({ ...trail, [key]: value }));
  }

  function setBurstTrailNested<
    T extends
      | 'width'
      | 'particleSize'
      | 'placement'
      | 'spacing'
      | 'lifetime'
      | 'intensity'
      | 'flicker'
      | 'motion',
  >(layerKey: StarLayerKey | undefined, section: T, key: keyof BurstTrail[T], value: number) {
    patchBurstTrail(layerKey, (trail) => ({
      ...trail,
      [section]: {
        ...trail[section],
        [key]: value,
      },
    }));
  }

  function setTrailBias(layerKey: StarLayerKey | undefined, value: number) {
    patchBurstTrail(layerKey, (trail) => ({
      ...trail,
      frontClump: frontClumpFromTrailBias(value),
    }));
  }

  function setStreakCount(value: number) {
    mutate((draft) => {
      const brocade = ensureRecord(draft, 'brocade');
      brocade.streakCount = value;
      draft.size = value;
    });
  }

  function renderBurstTrailControls(layerKey?: StarLayerKey) {
    const burstTrail = currentBurstTrail(layerKey);
    const trailsEnabled = burstTrail.enabled;
    const controlDisabled =
      disabled || !trailsEnabled || (layerKey ? !design.stars[layerKey].enabled : false);
    const title = layerKey === 'core' ? 'Trail Inner' : 'Trail';
    const toggleId =
      layerKey === 'core'
        ? coreTrailsToggleId
        : layerKey === 'outer'
          ? outerTrailsToggleId
          : headsToggleId;
    const fallbackPreset = burstTrail.preset === 'custom' ? 'custom' : burstTrail.preset;
    const editableStops =
      burstTrail.stops.length > 0 ? burstTrail.stops : makeBurstTrailPreset(fallbackPreset).stops;
    const particleShape = shapeOptionFromStops(editableStops);
    const trailBias = trailBiasFromFrontClump(burstTrail.frontClump);

    function resetToPreset() {
      setBurstTrailPreset(layerKey, fallbackPreset);
    }

    function patchBurstTrailStops(updater: (stop: BurstTrailStop) => BurstTrailStop) {
      patchBurstTrail(layerKey, (trail) => {
        const source =
          trail.stops.length > 0
            ? trail.stops
            : makeBurstTrailPreset(trail.preset === 'custom' ? 'custom' : trail.preset).stops;
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
        title={title}
        collapsible
        defaultExpanded={false}
        inactive={!trailsEnabled || (layerKey ? !design.stars[layerKey].enabled : false)}
        titleAccessory={
          <InfoTooltip text="Master switch for burst trail particles behind the star paths." />
        }
        action={
          <Switch
            id={toggleId}
            aria-label={`Show ${title.toLowerCase()}`}
            checked={trailsEnabled}
            onCheckedChange={(value) => setBurstTrailEnabled(layerKey, value)}
            disabled={disabled || (layerKey ? !design.stars[layerKey].enabled : false)}
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
                onChange={(value) => setBurstTrailPreset(layerKey, value as BurstTrailPreset)}
                options={TRAIL_PRESET_OPTIONS}
                ariaLabel="Trail style"
                disabled={controlDisabled}
              />
            </Field>
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel>Trail colour</FieldLabel>
                <InfoTooltip text="Gold and silver are classic metallic chemistries. Star colour follows each star's own colour." />
              </div>
              <SelectField
                value={burstTrail.colourMode}
                onChange={(value) => setBurstTrailValue(layerKey, 'colourMode', value)}
                options={TRAIL_COLOR_OPTIONS}
                ariaLabel="Trail colour"
                disabled={controlDisabled}
              />
            </Field>
          </div>

          <SubSection title="Particles">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Amount"
                min={0}
                max={BURST_TRAIL_PARTICLES_PER_STAR_MAX}
                step={1}
                value={burstTrail.particlesPerStar}
                showNumberInput
                inputAriaLabel="Amount value"
                disabled={controlDisabled}
                hint="Total number of particles in each star's trail. Higher is thicker and fuller."
                onChange={(value) =>
                  setBurstTrailValue(layerKey, 'particlesPerStar', Math.round(value))
                }
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
                  disabled={controlDisabled}
                />
              </Field>
              <SliderField
                label="Particle size"
                min={0.08}
                max={TRAIL_PARTICLE_SIZE_MAX}
                step={0.05}
                value={burstTrail.particleSize.base}
                showNumberInput
                inputAriaLabel="Particle size value"
                disabled={controlDisabled}
                hint="Global size for every trail particle before head and tail scaling."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'particleSize', 'base', round2(value))
                }
              />
              <SliderField
                label="Head scale"
                min={0}
                max={TRAIL_PARTICLE_SCALE_MAX}
                step={0.05}
                value={burstTrail.particleSize.headScale}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Head scale value"
                disabled={controlDisabled}
                hint="Size multiplier when each trail particle first appears near the star head."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'particleSize', 'headScale', round2(value))
                }
              />
              <SliderField
                label="Tail scale"
                min={0}
                max={TRAIL_PARTICLE_SCALE_MAX}
                step={0.05}
                value={burstTrail.particleSize.tailScale}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Tail scale value"
                disabled={controlDisabled}
                hint="Size multiplier as each particle ages into the old tail."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'particleSize', 'tailScale', round2(value))
                }
              />
              <SliderField
                label="Size random"
                min={0}
                max={100}
                step={1}
                value={burstTrail.particleSize.variationPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Size random value"
                disabled={controlDisabled}
                hint="Seeded size variation. Replay stays deterministic, but particles do not all match exactly."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'particleSize', 'variationPercent', round2(value))
                }
              />
              <SliderField
                label="Rotation"
                min={0}
                max={TRAIL_ROTATION_MAX}
                step={0.1}
                value={burstTrail.motion.spin}
                formatValue={formatRotation}
                showNumberInput
                inputAriaLabel="Rotation value"
                disabled={controlDisabled}
                hint="0 keeps every particle locked in place. Higher values randomise the starting angle and spin the particles while they fade."
                onChange={(value) => setBurstTrailNested(layerKey, 'motion', 'spin', round2(value))}
              />
            </div>
          </SubSection>

          <SubSection title="Placement">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <SliderField
                label="Head-tail balance"
                min={TRAIL_BIAS_MIN}
                max={TRAIL_BIAS_MAX}
                step={1}
                value={trailBias}
                formatValue={formatTrailBias}
                disabled={controlDisabled}
                hint="Where the total particle budget lands along each star path. This redistributes placement without changing the amount."
                onChange={(value) => setTrailBias(layerKey, round2(value))}
              />
              <SliderField
                label="Spacing curve"
                min={TRAIL_SPACING_CURVE_MIN}
                max={TRAIL_SPACING_CURVE_MAX}
                step={0.05}
                value={burstTrail.spacing.curve}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Spacing curve value"
                disabled={controlDisabled}
                hint="Curves where particles are spent along the path. 1x is linear; higher values make the balance fall off more exponentially toward the selected end."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'spacing', 'curve', round2(value))
                }
              />
              <SliderField
                label="Gap random"
                min={0}
                max={100}
                step={1}
                value={burstTrail.spacing.jitterPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Gap random value"
                disabled={controlDisabled}
                hint="Seeded randomness inside each spacing gap. 0% is even spacing; higher values make the trail more irregular."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'spacing', 'jitterPercent', round2(value))
                }
              />
              <SliderField
                label="Head gap"
                min={0}
                max={TRAIL_HEAD_GAP_MAX}
                step={1}
                value={burstTrail.placement.headGapPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Head gap value"
                disabled={controlDisabled}
                hint="How far newly generated particles start behind the star head. 0% can overlap the star; particles are never pushed in front."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'placement', 'headGapPercent', round2(value))
                }
              />
              <SliderField
                label="Front angle"
                min={0}
                max={TRAIL_SPREAD_ANGLE_MAX}
                step={1}
                value={burstTrail.width.front}
                formatValue={formatDegrees}
                showNumberInput
                inputAriaLabel="Front angle value"
                disabled={controlDisabled}
                hint="Spread angle around the fresh head end of the trail. Higher values scatter particles wider around the current star path."
                onChange={(value) => setBurstTrailNested(layerKey, 'width', 'front', round2(value))}
              />
              <SliderField
                label="Tail angle"
                min={0}
                max={TRAIL_SPREAD_ANGLE_MAX}
                step={1}
                value={burstTrail.width.tail}
                formatValue={formatDegrees}
                showNumberInput
                inputAriaLabel="Tail angle value"
                disabled={controlDisabled}
                hint="Spread angle around the old tail end. 0 degrees keeps the tail tight; higher values leave a wider tail."
                onChange={(value) => setBurstTrailNested(layerKey, 'width', 'tail', round2(value))}
              />
              <SliderField
                label="Particle life"
                min={1}
                max={100}
                step={1}
                value={burstTrail.lifetime.percent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Particle life value"
                disabled={controlDisabled}
                hint="How long each trail particle lives, as a percentage of the star's total flight. Early particles can fade out while later particles keep appearing."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'lifetime', 'percent', round2(value))
                }
              />
              <SliderField
                label="Life random"
                min={0}
                max={100}
                step={1}
                value={burstTrail.lifetime.variationPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Life random value"
                disabled={controlDisabled}
                hint="Seeded variation in each particle's individual life. Replay stays deterministic."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'lifetime', 'variationPercent', round2(value))
                }
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
                disabled={controlDisabled}
                hint="How brightly the trail burns. 1 is standard; push higher for a hot, glowing trail."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'intensity', 'brightness', round2(value))
                }
              />
              <SliderField
                label="Fade softness"
                min={0.2}
                max={4}
                step={0.05}
                value={burstTrail.intensity.fadeSoftness}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Fade softness value"
                disabled={controlDisabled}
                hint="How gently each particle cools from its hot colour into the tail colour."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'intensity', 'fadeSoftness', round2(value))
                }
              />
              <SliderField
                label="Flicker"
                min={0}
                max={1}
                step={0.01}
                value={burstTrail.flicker.chance}
                disabled={controlDisabled}
                hint="Chance each particle twinkles white-hot, for a glittering, crackly trail. 0 is steady."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'flicker', 'chance', round2(value))
                }
              />
            </div>
          </SubSection>

          <Button
            type="button"
            variant="secondary"
            onClick={resetToPreset}
            disabled={controlDisabled}
            className="w-full"
          >
            <RotateCcw size={16} />
            Reset to preset
          </Button>
        </div>
      </PanelSection>
    );
  }

  function renderStarLayerControls(layerKey: StarLayerKey, title: 'Star' | 'Star Inner') {
    const layer = design.stars[layerKey];
    const controlDisabled = sectionDisabled[layerKey];
    const toggleId = layerKey === 'outer' ? outerToggleId : coreToggleId;
    const isInnerLayer = layerKey === 'core';

    return (
      <PanelSection
        title={title}
        collapsible
        defaultExpanded={false}
        inactive={!layer.enabled}
        titleAccessory={
          <InfoTooltip text={`${title} has its own burst, head, colour, and trail settings.`} />
        }
        action={
          <Switch
            id={toggleId}
            aria-label={title}
            checked={layer.enabled}
            onCheckedChange={(value) => setLayerValue(layerKey, 'enabled', value)}
            disabled={disabled}
          />
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {showStarCount ? (
              <SliderField
                label="Star count"
                min={STAR_COUNT_MIN}
                max={STAR_COUNT_MAX}
                step={1}
                value={Math.min(STAR_COUNT_MAX, Math.max(STAR_COUNT_MIN, Math.round(layer.count)))}
                disabled={controlDisabled}
                hint={
                  isInnerLayer
                    ? 'How many inner stars this layer breaks into. It starts smaller, but can be made fuller than Star.'
                    : 'How many stars this layer breaks into. Fuller shells are capped at 100 for a clean preview.'
                }
                onChange={(value) =>
                  setLayerValue(
                    layerKey,
                    'count',
                    Math.min(STAR_COUNT_MAX, Math.max(STAR_COUNT_MIN, Math.round(value))),
                  )
                }
              />
            ) : null}
            <SliderField
              label="Burst size"
              min={0.5}
              max={12}
              step={0.1}
              value={round2(rangeMid(layer.burst.speed))}
              disabled={controlDisabled}
              hint={
                isInnerLayer
                  ? 'How far Star Inner flies from the centre. It can sit inside Star or push past it.'
                  : 'How far Star flies from the centre.'
              }
              onChange={(value) =>
                setLayerBurstRangeMid(layerKey, 'speed', value, BROCADE_SPEED_HALF_WIDTH)
              }
            />
            <SliderField
              label="Hang time"
              min={0.5}
              max={8}
              step={0.1}
              value={round2(rangeMid(layer.burst.life))}
              formatValue={formatSeconds}
              disabled={controlDisabled}
              hint="How long this layer's stars burn before fading."
              onChange={(value) =>
                setLayerBurstRangeMid(layerKey, 'life', value, BROCADE_LIFE_HALF_WIDTH)
              }
            />
            <SliderField
              label="Floatiness"
              min={-1.85}
              max={0}
              step={0.01}
              value={round2(rangeUpper(layer.burst.gravity))}
              disabled={controlDisabled}
              hint="0 keeps this layer almost flat; more negative values let it sink faster."
              onChange={(value) => setLayerGravityUpper(layerKey, value)}
            />
            <SliderField
              label="Star size"
              min={STAR_SIZE_MIN}
              max={STAR_SIZE_MAX}
              step={STAR_SIZE_STEP}
              value={layer.head.size}
              disabled={controlDisabled}
              hint="Size budget for each glowing star in this layer."
              onChange={(value) => setLayerNestedValue(layerKey, 'head', 'size', value)}
            />
            <CalibratedSliderField
              label="Glow strength"
              range={headGlowStrengthRange}
              value={layer.head.glowStrength}
              disabled={controlDisabled}
              hint="Halo brightness around each star in this layer."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'glowStrength', round2(value))
              }
            />
          </div>

          {renderStarAppearance(
            layerKey,
            controlDisabled,
            layerKey === 'outer' ? starControls : undefined,
          )}

          {renderBurstTrailControls(layerKey)}
        </div>
      </PanelSection>
    );
  }

  if (isBrocade) {
    return (
      <>
        <PanelSection title="Burst" collapsible defaultExpanded={false}>
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
            {showLaunch
              ? renderLiftVelocityControl(
                  'Launch speed, which sets the burst height. 15 is the normal preset.',
                )
              : null}
            {showLaunch ? renderBoomControl() : null}
          </div>
        </PanelSection>

        {afterBurst}

        {renderLiftParticleControls()}

        {renderSmokeControls()}

        {renderBurstTrailControls()}

        <PanelSection
          title="Heads"
          collapsible
          defaultExpanded={false}
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
              <CalibratedSliderField
                label="Glow strength"
                range={brocadeGlowStrengthRange}
                value={design.brocade.glowStrength}
                disabled={sectionDisabled.heads}
                hint="Halo brightness around each head, and how strongly the burst tints the ground light."
                onChange={(value) => setBrocadeValue('glowStrength', round2(value))}
              />
            </div>
            {renderStarAppearance('outer', sectionDisabled.heads)}
          </div>
        </PanelSection>
      </>
    );
  }

  return (
    <>
      {showLaunch ? (
        <PanelSection title="Launch" collapsible defaultExpanded={false}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {renderLiftVelocityControl(
              'Launch speed, which sets the burst height. Small keeps effects low; High throws them taller.',
            )}
            {renderBoomControl()}
          </div>
        </PanelSection>
      ) : null}

      {afterBurst}

      {renderLiftParticleControls()}

      {renderSmokeControls()}

      {renderStarLayerControls('outer', 'Star')}

      {renderStarLayerControls('core', 'Star Inner')}

      <PanelSection
        title="Strobe"
        collapsible
        defaultExpanded={false}
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
        defaultExpanded={false}
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
        <PanelSection
          title="Split"
          collapsible
          defaultExpanded={false}
          inactive={!design.split.enabled}
          titleAccessory={<InfoTooltip text="Crossette stars split into smaller fragments." />}
          action={
            <Switch
              id={splitToggleId}
              aria-label="Split"
              checked={design.split.enabled}
              onCheckedChange={(value) => setNestedRenderValue('split', 'enabled', value)}
              disabled={disabled}
            />
          }
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <SliderField
              label="Split fragments"
              min={2}
              max={8}
              step={1}
              value={design.split.fragments}
              disabled={sectionDisabled.split}
              hint="How many pieces each crossette star splits into."
              onChange={(value) => setNestedRenderValue('split', 'fragments', value)}
            />
            <SliderField
              label="Split speed"
              min={0.4}
              max={4}
              step={0.05}
              value={design.split.speed}
              disabled={sectionDisabled.split}
              hint="How hard the fragments kick away from the split."
              onChange={(value) => setNestedRenderValue('split', 'speed', round2(value))}
            />
          </div>
        </PanelSection>
      ) : null}
    </>
  );
}
