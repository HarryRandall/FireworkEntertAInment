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
import { ChevronDown } from 'lucide-react';
import { ColorField } from '@/components/admin/ColorField';
import { Field, FieldLabel } from '@/components/design-system/Field';
import { InfoTooltip } from '@/components/design-system/InfoTooltip';
import { SelectField } from '@/components/design-system/SelectField';
import { SliderField } from '@/components/design-system/SliderField';
import { Switch } from '@/components/ui/switch';
import {
  BURST_TRAIL_FLICKER_LIFE_MAX,
  BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX,
  BURST_TRAIL_PARTICLES_PER_STAR_MAX,
  FIREWORK_GEOMETRIES,
  FIREWORK_PATTERNS,
  FIREWORK_TRAIL_PROFILES,
  STAR_AIR_RESISTANCE_PERCENT_MAX,
  STAR_TERMINAL_VELOCITY_MAX,
  makeBurstTrailPreset,
  type BurstTrailPreset,
  type FireworkDesign,
  type FireworkStarLayer,
  type GeometryTuningGroupKey,
  type LaunchShellShape,
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
  MAX_BRIGHTNESS_HOLD_EXPONENT,
  MAX_BRIGHTNESS_HOLD_PERCENT,
  MIN_CORE_BRIGHTNESS,
  MIN_CORE_OPACITY_FALLOFF,
  MIN_CORE_SOFTNESS,
  MIN_BRIGHTNESS_HOLD_EXPONENT,
  MIN_BRIGHTNESS_HOLD_PERCENT,
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
type StarColourPatternEntry = FireworkStarLayer['colourPattern']['colours'][number];

/** Which geometry-tuning group drives each burst geometry. Geometries without
 *  bespoke shape behaviour (sphere, split_cross) have no entry and show no
 *  Geometry panel. */
const GEOMETRY_TUNING_GROUPS: Partial<Record<FireworkDesign['geometry'], GeometryTuningGroupKey>> =
  {
    ring: 'ring',
    crown: 'crown',
    weeping: 'weeping',
    radial_arms: 'radialArms',
    falling_tail: 'fallingTail',
    pearls: 'pearls',
    fragment_cloud: 'fragmentCloud',
    heart: 'heart',
    five_point_star: 'fivePointStar',
    bowtie: 'bowtie',
    fish: 'fish',
    waterfall: 'waterfall',
    whirl: 'whirl',
    single_tail: 'singleTail',
    upward_fan: 'upwardFan',
    roman_candle: 'romanCandle',
    fountain: 'fountain',
  };

type GeometryTuningSlider = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
};

const PERCENT_HINTS = {
  count: 'Percentage of the star count this shape actually uses.',
  life: 'Star burn time relative to the burst life setting. 100% is unchanged.',
  gravity: 'How strongly gravity pulls these stars, relative to the burst gravity.',
  drag: 'Air resistance relative to a standard star. Lower drifts further.',
  headSize: 'Star head size relative to the layer size budget.',
  trailLife: 'Trail persistence relative to the standard trail life.',
};

const GEOMETRY_TUNING_SLIDERS: Record<GeometryTuningGroupKey, GeometryTuningSlider[]> = {
  ring: [
    {
      key: 'countPercent',
      label: 'Ring stars',
      min: 1,
      max: 100,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'wobble',
      label: 'Wobble',
      min: 0,
      max: 1,
      step: 0.01,
      hint: 'Out-of-plane jitter so the hoop reads as 3D rather than a razor line.',
    },
    {
      key: 'verticalSquash',
      label: 'Vertical squash',
      min: 0.2,
      max: 1.5,
      step: 0.01,
      hint: '1 is a perfect circle; lower flattens the hoop.',
    },
    {
      key: 'tiltVariation',
      label: 'Tilt variation',
      min: 0,
      max: 3,
      step: 0.05,
      hint: 'How far the hoop plane can randomly tilt, in radians.',
    },
    {
      key: 'lifePercent',
      label: 'Star life',
      min: 10,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
  ],
  crown: [
    {
      key: 'lift',
      label: 'Upward throw',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'How hard each frond is thrown upward before drooping.',
    },
    {
      key: 'liftVariation',
      label: 'Throw variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra upward throw per star.',
    },
    {
      key: 'spread',
      label: 'Spread',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Sideways reach of the fronds.',
    },
    {
      key: 'spreadVariation',
      label: 'Spread variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra sideways reach per star.',
    },
  ],
  weeping: [
    {
      key: 'lift',
      label: 'Upward throw',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'How hard each strand is thrown upward before hanging.',
    },
    {
      key: 'liftVariation',
      label: 'Throw variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra upward throw per star.',
    },
    {
      key: 'spread',
      label: 'Spread',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Sideways reach of the strands.',
    },
    {
      key: 'spreadVariation',
      label: 'Spread variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra sideways reach per star.',
    },
    {
      key: 'lifePercent',
      label: 'Star life',
      min: 10,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
    {
      key: 'gravityPercent',
      label: 'Gravity',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.gravity,
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
  ],
  radialArms: [
    {
      key: 'arms',
      label: 'Arms',
      min: 2,
      max: 24,
      step: 1,
      hint: 'Number of straight spokes the stars group into.',
    },
    {
      key: 'countPercent',
      label: 'Arm stars',
      min: 1,
      max: 100,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'angleJitter',
      label: 'Arm scatter',
      min: 0,
      max: 1,
      step: 0.01,
      hint: 'Random angular scatter of each star off its spoke.',
    },
    {
      key: 'armLength',
      label: 'Arm length',
      min: 0.1,
      max: 2,
      step: 0.01,
      hint: 'Base spoke length relative to burst speed.',
    },
    {
      key: 'lift',
      label: 'Upward throw',
      min: -1,
      max: 2,
      step: 0.01,
      hint: 'Vertical push applied to the whole spider.',
    },
    {
      key: 'liftVariation',
      label: 'Throw variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra vertical push per star.',
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
  ],
  fallingTail: [
    {
      key: 'countPercent',
      label: 'Tail stars',
      min: 1,
      max: 100,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'spread',
      label: 'Spread',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Sideways push before the stars start sinking.',
    },
    {
      key: 'spreadVariation',
      label: 'Spread variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra sideways push per star.',
    },
    {
      key: 'sink',
      label: 'Sink speed',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Initial downward speed of the tails.',
    },
    {
      key: 'sinkVariation',
      label: 'Sink variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra downward speed per star.',
    },
    {
      key: 'lifePercent',
      label: 'Star life',
      min: 10,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
    {
      key: 'gravityPercent',
      label: 'Gravity',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.gravity,
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
  ],
  pearls: [
    {
      key: 'countPercent',
      label: 'Pearl stars',
      min: 1,
      max: 100,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'spread',
      label: 'Spread',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Sideways reach of the pearl ring.',
    },
    {
      key: 'spreadVariation',
      label: 'Spread variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra reach per pearl.',
    },
    {
      key: 'lift',
      label: 'Upward throw',
      min: -1,
      max: 2,
      step: 0.01,
      hint: 'Vertical push of the pearl ring.',
    },
    {
      key: 'liftVariation',
      label: 'Throw variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra vertical push per pearl.',
    },
    {
      key: 'lifePercent',
      label: 'Star life',
      min: 10,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
    {
      key: 'gravityPercent',
      label: 'Gravity',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.gravity,
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
  ],
  fragmentCloud: [
    {
      key: 'countPercent',
      label: 'Cloud stars',
      min: 1,
      max: 100,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'speedBase',
      label: 'Base speed',
      min: 0.1,
      max: 2,
      step: 0.01,
      hint: 'Minimum speed factor for each fragment.',
    },
    {
      key: 'speedVariation',
      label: 'Speed variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra speed so the cloud looks uneven.',
    },
  ],
  heart: [
    {
      key: 'countPercent',
      label: 'Outline stars',
      min: 1,
      max: 100,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'scaleX',
      label: 'Width',
      min: 0.2,
      max: 2.5,
      step: 0.01,
      hint: 'Horizontal scale of the heart outline.',
    },
    {
      key: 'scaleY',
      label: 'Height',
      min: 0.2,
      max: 2.5,
      step: 0.01,
      hint: 'Vertical scale of the heart outline.',
    },
    {
      key: 'depthScale',
      label: 'Depth',
      min: 0,
      max: 1,
      step: 0.01,
      hint: 'Front-to-back thickness. 0 keeps the heart perfectly planar.',
    },
    {
      key: 'outlineJitter',
      label: 'Outline variation',
      min: 0,
      max: 0.4,
      step: 0.005,
      hint: 'Seeded scatter around the mathematical heart outline.',
    },
    {
      key: 'tiltVariation',
      label: 'Tilt variation',
      min: 0,
      max: 3,
      step: 0.05,
      hint: 'Random tilt of the heart plane, in radians.',
    },
    {
      key: 'rotationDegrees',
      label: 'Rotation',
      min: -180,
      max: 180,
      step: 1,
      hint: 'Rotation of the heart inside its plane, in degrees.',
    },
  ],
  fivePointStar: [
    {
      key: 'countPercent',
      label: 'Outline stars',
      min: 1,
      max: 100,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'points',
      label: 'Points',
      min: 3,
      max: 12,
      step: 1,
      hint: 'Number of points in the outlined star polygon.',
    },
    {
      key: 'innerRadius',
      label: 'Inner radius',
      min: 0.08,
      max: 0.95,
      step: 0.01,
      hint: 'Depth of the valleys between points. Lower values make sharper points.',
    },
    {
      key: 'scaleX',
      label: 'Width',
      min: 0.2,
      max: 2.5,
      step: 0.01,
      hint: 'Horizontal scale of the star outline.',
    },
    {
      key: 'scaleY',
      label: 'Height',
      min: 0.2,
      max: 2.5,
      step: 0.01,
      hint: 'Vertical scale of the star outline.',
    },
    {
      key: 'depthScale',
      label: 'Depth',
      min: 0,
      max: 1,
      step: 0.01,
      hint: 'Front-to-back thickness. 0 keeps the star perfectly planar.',
    },
    {
      key: 'outlineJitter',
      label: 'Outline variation',
      min: 0,
      max: 0.4,
      step: 0.005,
      hint: 'Seeded scatter around the polygon outline.',
    },
    {
      key: 'tiltVariation',
      label: 'Tilt variation',
      min: 0,
      max: 3,
      step: 0.05,
      hint: 'Random tilt of the star plane, in radians.',
    },
    {
      key: 'rotationDegrees',
      label: 'Rotation',
      min: -180,
      max: 180,
      step: 1,
      hint: 'Rotation of the star inside its plane, in degrees.',
    },
  ],
  bowtie: [
    {
      key: 'countPercent',
      label: 'Lobe stars',
      min: 1,
      max: 100,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'fanAngleDegrees',
      label: 'Fan angle',
      min: 10,
      max: 180,
      step: 1,
      hint: 'Total opening angle of each lobe fan, in degrees.',
    },
    {
      key: 'verticalScale',
      label: 'Fan height',
      min: 0,
      max: 1.5,
      step: 0.01,
      hint: 'Vertical thickness of the fans.',
    },
    {
      key: 'depthScale',
      label: 'Fan depth',
      min: 0,
      max: 1.5,
      step: 0.01,
      hint: 'Front-to-back thickness of the fans.',
    },
    {
      key: 'lengthBase',
      label: 'Lobe length',
      min: 0.1,
      max: 2,
      step: 0.01,
      hint: 'Base lobe length relative to burst speed.',
    },
    {
      key: 'lengthVariation',
      label: 'Length variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra lobe length per star.',
    },
  ],
  fish: [
    {
      key: 'countPercent',
      label: 'Swarm size',
      min: 1,
      max: 200,
      step: 1,
      hint: 'Swarm count as a percentage of the star count.',
    },
    {
      key: 'verticalScale',
      label: 'Flatten',
      min: 0,
      max: 1.5,
      step: 0.01,
      hint: '1 is a full sphere; lower keeps the swarm flat.',
    },
    {
      key: 'lifeBaseSeconds',
      label: 'Life base',
      min: 0.1,
      max: 8,
      step: 0.1,
      hint: 'Minimum swim time in seconds.',
    },
    {
      key: 'lifeVariationSeconds',
      label: 'Life spread',
      min: 0,
      max: 8,
      step: 0.1,
      hint: 'Random extra swim time in seconds.',
    },
    {
      key: 'wiggleStrength',
      label: 'Wiggle strength',
      min: 0,
      max: 8,
      step: 0.1,
      hint: 'How hard each fish darts side to side.',
    },
    {
      key: 'wiggleRate',
      label: 'Wiggle rate',
      min: 0,
      max: 40,
      step: 0.5,
      hint: 'Wiggle oscillations per second on the primary axis.',
    },
    {
      key: 'wiggleRateCross',
      label: 'Cross wiggle rate',
      min: 0,
      max: 40,
      step: 0.5,
      hint: 'Wiggle oscillations per second on the crossing axis.',
    },
    {
      key: 'gravityPercent',
      label: 'Gravity',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.gravity,
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
    {
      key: 'headSizePercent',
      label: 'Head size',
      min: 5,
      max: 200,
      step: 1,
      hint: PERCENT_HINTS.headSize,
    },
    {
      key: 'trailLifePercent',
      label: 'Trail life',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.trailLife,
    },
  ],
  waterfall: [
    {
      key: 'countPercent',
      label: 'Curtain stars',
      min: 1,
      max: 200,
      step: 1,
      hint: 'Curtain count as a percentage of the star count.',
    },
    {
      key: 'curtainWidth',
      label: 'Curtain width',
      min: 0.2,
      max: 6,
      step: 0.05,
      hint: 'Curtain width relative to the shell size.',
    },
    {
      key: 'scatterX',
      label: 'Width scatter',
      min: 0,
      max: 120,
      step: 1,
      hint: 'Random horizontal scatter of each spawn point.',
    },
    {
      key: 'scatterZ',
      label: 'Depth scatter',
      min: 0,
      max: 120,
      step: 1,
      hint: 'Random depth scatter of each spawn point.',
    },
    {
      key: 'dropStart',
      label: 'Drop start',
      min: 0,
      max: 240,
      step: 1,
      hint: 'How far below the burst point stars may start.',
    },
    {
      key: 'fallSpeed',
      label: 'Fall speed',
      min: 0,
      max: 6,
      step: 0.05,
      hint: 'Base downward speed of the curtain.',
    },
    {
      key: 'fallSpeedVariation',
      label: 'Fall variation',
      min: 0,
      max: 6,
      step: 0.05,
      hint: 'Random extra downward speed per star.',
    },
    {
      key: 'sideDrift',
      label: 'Side drift',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Sideways drift while falling.',
    },
    {
      key: 'depthDrift',
      label: 'Depth drift',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Front-to-back drift while falling.',
    },
    {
      key: 'lifePercent',
      label: 'Star life',
      min: 10,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
    {
      key: 'gravityBase',
      label: 'Gravity pull',
      min: -2,
      max: 0,
      step: 0.01,
      hint: 'Base gravity while falling; more negative falls faster.',
    },
    {
      key: 'gravityVariation',
      label: 'Gravity variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra gravity per star.',
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
    {
      key: 'headSizePercent',
      label: 'Head size',
      min: 5,
      max: 200,
      step: 1,
      hint: PERCENT_HINTS.headSize,
    },
  ],
  whirl: [
    {
      key: 'countPercent',
      label: 'Whirl stars',
      min: 1,
      max: 200,
      step: 1,
      hint: 'Whirl count as a percentage of the star count.',
    },
    {
      key: 'minCount',
      label: 'Minimum stars',
      min: 1,
      max: 200,
      step: 1,
      hint: 'Lower bound on the whirl count regardless of shell size.',
    },
    {
      key: 'verticalBias',
      label: 'Vertical bias',
      min: -1,
      max: 1,
      step: 0.01,
      hint: 'Negative sends more stars downward; positive lifts the whirl.',
    },
    {
      key: 'spinStrength',
      label: 'Spin strength',
      min: 0,
      max: 10,
      step: 0.1,
      hint: 'How hard the spiral force pulls the corkscrew arms.',
    },
    {
      key: 'spinRate',
      label: 'Spin rate',
      min: 0,
      max: 40,
      step: 0.5,
      hint: 'Spiral oscillations per second.',
    },
    {
      key: 'lifeBaseSeconds',
      label: 'Life base',
      min: 0.1,
      max: 8,
      step: 0.1,
      hint: 'Minimum star burn time in seconds.',
    },
    {
      key: 'lifeVariationSeconds',
      label: 'Life spread',
      min: 0,
      max: 8,
      step: 0.1,
      hint: 'Random extra burn time in seconds.',
    },
    {
      key: 'gravityPercent',
      label: 'Gravity',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.gravity,
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
    {
      key: 'headSizePercent',
      label: 'Head size',
      min: 5,
      max: 200,
      step: 1,
      hint: PERCENT_HINTS.headSize,
    },
    {
      key: 'trailLifePercent',
      label: 'Trail life',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.trailLife,
    },
  ],
  singleTail: [
    {
      key: 'inheritPercent',
      label: 'Carried speed',
      min: 0,
      max: 100,
      step: 1,
      hint: 'How much of the shell velocity the comet keeps.',
    },
    {
      key: 'driftPercent',
      label: 'Drift',
      min: 0,
      max: 100,
      step: 1,
      hint: 'Random sideways drift as a percentage of burst speed.',
    },
    {
      key: 'riseFactor',
      label: 'Rise',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Minimum upward speed as a fraction of burst speed.',
    },
    {
      key: 'pushFactor',
      label: 'Push',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Extra upward push added to the inherited rise.',
    },
    {
      key: 'lifePercent',
      label: 'Star life',
      min: 10,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
    {
      key: 'headSizePercent',
      label: 'Head size',
      min: 5,
      max: 200,
      step: 1,
      hint: PERCENT_HINTS.headSize,
    },
    {
      key: 'trailLifePercent',
      label: 'Trail life',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.trailLife,
    },
  ],
  upwardFan: [
    {
      key: 'countPercent',
      label: 'Fan stars',
      min: 1,
      max: 200,
      step: 1,
      hint: PERCENT_HINTS.count,
    },
    {
      key: 'minCount',
      label: 'Minimum stars',
      min: 1,
      max: 200,
      step: 1,
      hint: 'Lower bound on the fan count regardless of shell size.',
    },
    {
      key: 'spreadAngleDegrees',
      label: 'Fan angle',
      min: 10,
      max: 300,
      step: 1,
      hint: 'Total sideways opening angle of the fan, in degrees.',
    },
    {
      key: 'fanBase',
      label: 'Fan reach',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Minimum sideways throw of each star.',
    },
    {
      key: 'fanVariation',
      label: 'Reach variation',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Random extra sideways throw per star.',
    },
    {
      key: 'spawnScatter',
      label: 'Tube scatter',
      min: 0,
      max: 120,
      step: 1,
      hint: 'Random horizontal scatter of each spawn point.',
    },
    {
      key: 'riseBase',
      label: 'Muzzle height',
      min: 0,
      max: 120,
      step: 1,
      hint: 'Base spawn height above the tube.',
    },
    {
      key: 'riseVariation',
      label: 'Height variation',
      min: 0,
      max: 120,
      step: 1,
      hint: 'Random extra spawn height per star.',
    },
    {
      key: 'riseSpeed',
      label: 'Rise speed',
      min: 0,
      max: 4,
      step: 0.01,
      hint: 'Base upward speed as a fraction of burst speed.',
    },
    {
      key: 'riseSpeedVariation',
      label: 'Rise variation',
      min: 0,
      max: 4,
      step: 0.01,
      hint: 'Random extra upward speed per star.',
    },
    {
      key: 'depthScale',
      label: 'Fan depth',
      min: 0,
      max: 1.5,
      step: 0.01,
      hint: 'Front-to-back thickness of the fan.',
    },
    {
      key: 'lifePercent',
      label: 'Star life',
      min: 10,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
    {
      key: 'headSizePercent',
      label: 'Head size',
      min: 5,
      max: 200,
      step: 1,
      hint: PERCENT_HINTS.headSize,
    },
    {
      key: 'trailLifePercent',
      label: 'Trail life',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.trailLife,
    },
  ],
  romanCandle: [
    {
      key: 'shotsPercent',
      label: 'Shots',
      min: 1,
      max: 100,
      step: 1,
      hint: 'Shot count as a percentage of the star count.',
    },
    {
      key: 'minShots',
      label: 'Minimum shots',
      min: 1,
      max: 60,
      step: 1,
      hint: 'Lower bound on the shot count regardless of shell size.',
    },
    {
      key: 'durationPercent',
      label: 'Sequence length',
      min: 5,
      max: 100,
      step: 1,
      hint: 'Length of the firing sequence relative to the shell life.',
    },
    {
      key: 'durationMinSeconds',
      label: 'Minimum length',
      min: 0.5,
      max: 30,
      step: 0.5,
      hint: 'Shortest allowed sequence, in seconds.',
    },
    {
      key: 'durationMaxSeconds',
      label: 'Maximum length',
      min: 1,
      max: 30,
      step: 0.5,
      hint: 'Longest allowed sequence, in seconds.',
    },
    {
      key: 'spread',
      label: 'Aim wobble',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Sideways aim wobble per shot, in radians.',
    },
    {
      key: 'azimuth',
      label: 'Depth wobble',
      min: 0,
      max: 2,
      step: 0.01,
      hint: 'Front-to-back aim wobble per shot, in radians.',
    },
    {
      key: 'speedBase',
      label: 'Shot speed',
      min: 0.1,
      max: 3,
      step: 0.01,
      hint: 'Minimum shot speed as a fraction of burst speed.',
    },
    {
      key: 'speedVariation',
      label: 'Speed variation',
      min: 0,
      max: 3,
      step: 0.01,
      hint: 'Random extra speed per shot.',
    },
    {
      key: 'muzzleScatter',
      label: 'Muzzle scatter',
      min: 0,
      max: 60,
      step: 1,
      hint: 'Random muzzle offset of each shot.',
    },
    {
      key: 'lateralScale',
      label: 'Sideways throw',
      min: 0,
      max: 1.5,
      step: 0.01,
      hint: 'Sideways speed factor of each shot.',
    },
    {
      key: 'depthScale',
      label: 'Depth throw',
      min: 0,
      max: 1.5,
      step: 0.01,
      hint: 'Front-to-back speed factor of each shot.',
    },
    {
      key: 'riseBase',
      label: 'Rise speed',
      min: 0,
      max: 4,
      step: 0.01,
      hint: 'Base upward speed of each shot.',
    },
    {
      key: 'riseVariation',
      label: 'Rise variation',
      min: 0,
      max: 4,
      step: 0.01,
      hint: 'Random extra upward speed per shot.',
    },
    {
      key: 'lifePercent',
      label: 'Star life',
      min: 10,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
    {
      key: 'headSizePercent',
      label: 'Head size',
      min: 5,
      max: 200,
      step: 1,
      hint: PERCENT_HINTS.headSize,
    },
    {
      key: 'trailLifePercent',
      label: 'Trail life',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.trailLife,
    },
  ],
  fountain: [
    {
      key: 'durationPercent',
      label: 'Spray length',
      min: 5,
      max: 100,
      step: 1,
      hint: 'Length of the spray relative to the shell life.',
    },
    {
      key: 'durationMinSeconds',
      label: 'Minimum length',
      min: 0.5,
      max: 30,
      step: 0.5,
      hint: 'Shortest allowed spray, in seconds.',
    },
    {
      key: 'durationMaxSeconds',
      label: 'Maximum length',
      min: 1,
      max: 30,
      step: 0.5,
      hint: 'Longest allowed spray, in seconds.',
    },
    {
      key: 'ratePercent',
      label: 'Spark rate',
      min: 10,
      max: 600,
      step: 1,
      hint: 'Sparks per second as a percentage of the star count.',
    },
    {
      key: 'minRatePerSecond',
      label: 'Minimum rate',
      min: 1,
      max: 400,
      step: 1,
      hint: 'Lower bound on sparks per second.',
    },
    {
      key: 'coneAngleDegrees',
      label: 'Cone angle',
      min: 2,
      max: 180,
      step: 1,
      hint: 'Total opening angle of the spray cone, in degrees.',
    },
    {
      key: 'speedBase',
      label: 'Spark speed',
      min: 0.05,
      max: 3,
      step: 0.01,
      hint: 'Minimum spark speed as a fraction of burst speed.',
    },
    {
      key: 'speedVariation',
      label: 'Speed variation',
      min: 0,
      max: 3,
      step: 0.01,
      hint: 'Random extra speed per spark.',
    },
    {
      key: 'spawnScatter',
      label: 'Nozzle scatter',
      min: 0,
      max: 60,
      step: 1,
      hint: "Random offset of each spark's spawn point.",
    },
    {
      key: 'lateralScale',
      label: 'Sideways spray',
      min: 0,
      max: 1.5,
      step: 0.01,
      hint: 'Sideways speed factor of the spray.',
    },
    {
      key: 'lifePercent',
      label: 'Spark life',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.life,
    },
    { key: 'dragPercent', label: 'Drag', min: 10, max: 300, step: 1, hint: PERCENT_HINTS.drag },
    {
      key: 'headSizePercent',
      label: 'Spark size',
      min: 5,
      max: 200,
      step: 1,
      hint: PERCENT_HINTS.headSize,
    },
    {
      key: 'trailLifePercent',
      label: 'Trail life',
      min: 5,
      max: 300,
      step: 1,
      hint: PERCENT_HINTS.trailLife,
    },
  ],
};

const BOOM_OPTIONS = [
  { value: 'none', label: 'None' },
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
  { value: 'silverRain', label: 'Silver rain' },
  { value: 'ghostFade', label: 'Ghost fade' },
  { value: 'dragonEgg', label: 'Dragon egg' },
  { value: 'titaniumFlash', label: 'Titanium flash' },
  { value: 'custom', label: 'Custom' },
];

const GEOMETRY_OPTIONS = FIREWORK_GEOMETRIES.filter((geometry) => geometry !== 'pistil').map(
  (geometry) => ({
    value: geometry,
    label:
      {
        sphere: 'Sphere',
        crown: 'Crown',
        weeping: 'Weeping willow',
        radial_arms: 'Radial arms',
        ring: 'Ring',
        split_cross: 'Split cross',
        falling_tail: 'Falling tail',
        single_tail: 'Single comet',
        upward_fan: 'Upward fan',
        fragment_cloud: 'Fragment cloud',
        heart: 'Heart',
        five_point_star: 'Outlined star',
        pearls: 'Pearls',
        fish: 'Flying fish',
        waterfall: 'Waterfall',
        whirl: 'Tourbillion',
        bowtie: 'Bow tie',
        roman_candle: 'Roman candle',
        fountain: 'Fountain',
      }[geometry] ?? geometry,
  }),
);

const PATTERN_OPTIONS = FIREWORK_PATTERNS.map((pattern) => ({
  value: pattern,
  label:
    {
      fibonacci: 'Fibonacci sphere',
      wave: 'Wave phase',
      strobe: 'Strobe phase',
    }[pattern] ?? pattern,
}));

const STAR_COLOUR_PATTERN_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'random', label: 'Random mix' },
  { value: 'bands', label: 'Bands' },
  { value: 'stripes', label: 'Stripes' },
] as const;

const STAR_COLOUR_AXIS_OPTIONS = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
] as const;

const TRAIL_PROFILE_OPTIONS = FIREWORK_TRAIL_PROFILES.map((profile) => ({
  value: profile,
  label:
    {
      none: 'None',
      spark: 'Spark',
      glitter: 'Glitter',
      long_hang: 'Long hang',
      thick_tail: 'Thick tail',
      fragmenting: 'Fragmenting',
      spray: 'Spray',
      blink: 'Blink',
      crackle: 'Crackle',
      pearls: 'Pearls',
      fish: 'Flying fish',
      waterfall: 'Waterfall',
      whirl: 'Tourbillion',
    }[profile] ?? profile,
}));

const TRAIL_LIFETIME_MODE_OPTIONS = [
  { value: 'dynamic', label: 'Follow star life' },
  { value: 'fixed', label: 'Fixed duration' },
];

const CRACKLE_COLOUR_OPTIONS = [
  { value: 'silver', label: 'Silver' },
  { value: 'star', label: 'Star colour' },
  { value: 'gold', label: 'Gold' },
];

const CRACKLE_SOUND_OPTIONS = [
  { value: 'crackle', label: 'Crackle' },
  { value: 'lightBoom', label: 'Light report' },
  { value: 'heavyBoom', label: 'Heavy report' },
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

const LAUNCH_SHELL_SHAPE_OPTIONS = [
  { value: 'circle', label: 'Glowing disc' },
  { value: 'orb', label: 'Soft orb' },
  { value: 'square', label: 'Square' },
  { value: 'triangle', label: 'Triangle' },
] satisfies { value: LaunchShellShape; label: string }[];

const LIFT_APPEARANCE_OPTIONS = [
  { value: 'inherit', label: 'Match burst trail' },
  { value: 'custom', label: 'Custom settings' },
];

const CONTROL_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-x-6 gap-y-4';

const BROCADE_SPEED_HALF_WIDTH = 0.6;
const BROCADE_LIFE_HALF_WIDTH = 0.6;
const BROCADE_HEAD_SIZE_MIN = 100;
const BROCADE_HEAD_SIZE_MAX = 4000;
const BROCADE_HEAD_SIZE_STEP = 50;
const STAR_COUNT_MIN = 1;
const STAR_COUNT_MAX = 100;
const STAR_SIZE_MIN = 10;
const STAR_SIZE_MAX = 1000;
const STAR_SIZE_STEP = 10;
const STAR_SPEED_MIN = 0;
const STAR_SPEED_MAX = 20;
const STAR_GRAVITY_MIN = -2;
const STAR_GRAVITY_MAX = 1;
const STAR_OPENING_COLOUR_HEX = '#ff6b14';
const STAR_OPENING_PERCENT_MIN = 1;
const STAR_OPENING_PERCENT_MAX = 100;
const STAR_CLOSING_COLOUR_HEX = '#ffd666';
const STAR_CLOSING_PERCENT_MIN = 1;
const STAR_CLOSING_PERCENT_MAX = 100;
const STAR_CLOSING_END_PERCENT_MIN = 0;
const STAR_CLOSING_END_PERCENT_MAX = 100;
const STAR_LIFE_MIN = 0.05;
const STAR_LIFE_MAX = 30;
const STAR_COLOUR_PATTERN_MAX_COLOURS = 8;
const BURST_TRAIL_SHELL_PARTICLE_BUDGET = 24_000;
const TRAIL_PARTICLE_SIZE_MAX = 24;
const TRAIL_PARTICLE_SCALE_MAX = 4;
const TRAIL_PARTICLE_LIFE_MAX = 2;
const TRAIL_OPENING_BRIGHTNESS_MAX = 300;
const SHELL_TRAIL_SPREAD_ANGLE_MAX = 60;
const TRAIL_SPREAD_ANGLE_MAX = 80;
const TRAIL_FRONT_SPREAD_ANGLE_MIN = 1;
const TRAIL_FRONT_SPREAD_ANGLE_MAX = BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX;
const TRAIL_BIAS_MIN = -100;
const TRAIL_BIAS_MAX = 100;
const TRAIL_HEAD_GAP_MAX = 300;
const TRAIL_SPACING_CURVE_MIN = 0.2;
const TRAIL_SPACING_CURVE_MAX = 4;
const TRAIL_ROTATION_MAX = 8;
const LAUNCH_SHELL_SIZE_SCALE_MIN = 0.25;
const LAUNCH_SHELL_SIZE_SCALE_MAX = 4;
const LAUNCH_SHELL_BRIGHTNESS_MAX = 3;
const SHELL_TRAIL_TUBE_DIAMETER_MAX = 90;
const SHELL_TRAIL_CURVE_MIN = 0.2;
const SHELL_TRAIL_CURVE_MAX = 4;
const LIFT_PARTICLE_AMOUNT_MAX = 1000;
const LIFT_PARTICLE_SIZE_MAX = 180;
const LIFT_PARTICLE_HEIGHT_PERCENT_MAX = 100;
const LIFT_PARTICLE_FLICKER_STRENGTH_MAX = 3;
const LIFT_PARTICLE_GRAVITY_MIN = -2;
const LIFT_PARTICLE_GRAVITY_MAX = 1;
const LIFT_PARTICLE_DRAG_MAX = 6;
const LIFT_PARTICLE_INHERITED_VELOCITY_MAX = 1;
const LIFT_PARTICLE_TURBULENCE_MAX = 2;
const LIFT_PATH_SAMPLES_MAX = 12;
const LIFT_SWIRL_STRENGTH_MAX = 4;
const LIFT_SWIRL_RADIUS_MAX = 180;
const LIFT_SWIRL_LOOP_COUNT_MAX = 6;
const LIFT_SWIRL_LOOP_LENGTH_MIN = 5;
const LIFT_SWIRL_LOOP_LENGTH_MAX = 100;
const LIFT_SWIRL_LOOP_HEIGHT_MAX = 180;
const LIFT_SWIRL_RATE_MAX = 16;
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

function rangeHalfWidth(range: [number, number]): number {
  return Math.abs(range[1] - range[0]) / 2;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function lifeRangeFromMidAndHalfWidth(mid: number, halfWidth: number): [number, number] {
  const safeMid = clampNumber(mid, STAR_LIFE_MIN, STAR_LIFE_MAX);
  const safeHalfWidth = clampNumber(
    halfWidth,
    0,
    Math.min(safeMid - STAR_LIFE_MIN, STAR_LIFE_MAX - safeMid),
  );
  return [round2(safeMid - safeHalfWidth), round2(safeMid + safeHalfWidth)];
}

function boundedRangeFromMidpoint(
  mid: number,
  halfWidth: number,
  min: number,
  max: number,
): [number, number] {
  const safeMid = clampNumber(mid, min, max);
  const safeHalfWidth = clampNumber(halfWidth, 0, Math.min(safeMid - min, max - safeMid));
  return [round2(safeMid - safeHalfWidth), round2(safeMid + safeHalfWidth)];
}

function formatSeconds(value: number): string {
  return `${value.toFixed(Number.isInteger(value * 10) ? 1 : 2)}s`;
}

function formatLifeVariation(value: number): string {
  return value <= 0 ? 'None' : `+/-${value.toFixed(Number.isInteger(value * 10) ? 1 : 2)}s`;
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

function formatProbability(value: number): string {
  return formatPercent(value * 100);
}

function formatRotation(value: number): string {
  if (value <= 0) return 'Off';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}x`;
}

function formatTurns(value: number): string {
  if (value <= 0) return 'Off';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} r/s`;
}

function formatLoopCount(value: number): string {
  if (value <= 0) return 'Off';
  const formatted = value.toFixed(value % 1 === 0 ? 0 : 1);
  return `${formatted} ${value === 1 ? 'loop' : 'loops'}`;
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
  fullWidth,
  onChange,
}: {
  label: string;
  value: number;
  range: CalibratedRange;
  disabled?: boolean;
  hint: ReactNode;
  fullWidth?: boolean;
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
      fullWidth={fullWidth}
      hint={hint}
      onChange={(next) => onChange(calibratedToRaw(next, range))}
    />
  );
}

function SwitchField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <Field>
      <div className="flex min-h-9 items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <InfoTooltip text={hint} />
        </div>
        <Switch
          id={id}
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      </div>
    </Field>
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
type StarHeadOpening = FireworkStarLayer['head']['opening'];
type StarHeadClosing = FireworkStarLayer['head']['closing'];
type BurstTrailOpening = BurstTrail['opening'];
type BurstTrailClosing = BurstTrail['closing'];
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

/**
 * Top-level editor category (Star, Trail, Smoke, ...). Categories are never
 * collapsible: the section rail navigates to them, so their controls stay
 * visible and only nested {@link SubSection} groups fold away detail.
 */
export function PanelSection({
  title,
  titleAccessory,
  action,
  inactive = false,
  children,
}: {
  title: string;
  titleAccessory?: ReactNode;
  action?: ReactNode;
  inactive?: boolean;
  children: ReactNode;
}) {
  const titleClassName = cn(
    'text-sm font-semibold',
    inactive ? 'text-muted-foreground' : 'text-[color:var(--color-content-emphasis)]',
  );

  return (
    <div className="space-y-4 border-t border-[color:var(--color-border-subtle)] pt-5 first:border-t-0 first:pt-0">
      <div className="flex min-h-10 items-center gap-2.5">
        <div className="flex min-h-10 items-center gap-2">
          <h3 className={titleClassName}>{title}</h3>
        </div>
        {titleAccessory ? <div className="flex items-center">{titleAccessory}</div> : null}
        {action ? <div className="ml-auto flex items-center gap-2.5">{action}</div> : null}
      </div>
      <div className={cn('transition-opacity', inactive && 'opacity-55')}>{children}</div>
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
  hint,
  action,
  defaultExpanded = false,
  children,
}: {
  title: string;
  /** Optional InfoTooltip copy. Keep helper prose here, not inline in panels. */
  hint?: ReactNode;
  action?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors',
        expanded
          ? 'border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)]'
          : 'border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)]/40',
      )}
    >
      {/* Tooltip and action triggers sit beside the disclosure button; they
          cannot nest inside it because all three are interactive. */}
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          className="focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors outline-none hover:bg-[color:var(--color-bg-subtle)]/60 focus-visible:ring-2"
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              !expanded && '-rotate-90',
            )}
            aria-hidden
          />
          <span className="text-[13px] font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
            {title}
          </span>
        </button>
        {hint ? (
          <div className="flex shrink-0 items-center pr-3">
            <InfoTooltip text={hint} />
          </div>
        ) : null}
        {action ? <div className="flex shrink-0 items-center pr-3">{action}</div> : null}
      </div>
      {expanded ? (
        <div
          id={contentId}
          className="border-t border-[color:var(--color-border-subtle)] px-3 pt-3 pb-3.5"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inline "Advanced" disclosure used to hide the long tail of fine-tuning
 * sliders so each section shows only its few common controls by default.
 * Renders full-width inside the compact control grid.
 */
function AdvancedControls({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const contentId = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="col-span-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="focus-visible:ring-ring/50 -ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-[color:var(--color-content-subtle)] transition-colors outline-none hover:text-[color:var(--color-content-emphasis)] focus-visible:ring-2"
      >
        <ChevronDown
          className={cn('size-3.5 shrink-0 transition-transform', !open && '-rotate-90')}
          aria-hidden
        />
        {open ? 'Hide advanced' : 'Advanced'}
      </button>
      {open ? (
        <div id={contentId} className={cn('mt-3', CONTROL_GRID_CLASS)}>
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
  /** Limit the editor to one reusable style-default surface. */
  controlScope?:
    | 'full'
    | 'star'
    | 'starInner'
    | 'trail'
    | 'geometry'
    | 'launch'
    | 'launchShell'
    | 'launchTrail'
    | 'smoke'
    | 'strobe'
    | 'crackle'
    | 'split'
    | 'sound';
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
  controlScope = 'full',
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
  const mortarDefaults = readRecord(defaults, 'mortar');
  const calibrationSource = calibrationDefaults ?? defaults;
  const calibrationStarsRecord = readRecord(calibrationSource, 'stars');
  const calibrationLayer = controlScope === 'starInner' ? 'core' : 'outer';
  const calibrationStars =
    Object.keys(readRecord(readRecord(calibrationStarsRecord, calibrationLayer), 'head')).length > 0
      ? readRecord(readRecord(calibrationStarsRecord, calibrationLayer), 'head')
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
  const isGroundEmitter =
    design.geometry === 'upward_fan' ||
    design.geometry === 'roman_candle' ||
    design.geometry === 'fountain';
  const headsEnabled = design.brocade.headsEnabled;
  const outerEnabled = isBrocade ? headsEnabled : design.stars.outer.enabled;
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
  const launchSoundValue =
    typeof soundDefaults.launch === 'boolean'
      ? soundDefaults.launch
      : typeof mortarDefaults.sound === 'boolean'
        ? mortarDefaults.sound
        : design.sound.launch;
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
          <div
            role="radiogroup"
            aria-label="Lift velocity"
            className="grid w-full grid-cols-4 gap-1 rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-subtle)]/50 p-1"
          >
            {LIFT_VELOCITY_OPTIONS.map((option) => {
              const active = selectedMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`Lift velocity ${option.label.toLowerCase()}`}
                  disabled={disabled}
                  onClick={() => setLiftVelocityMode(option.value)}
                  className={cn(
                    'focus-visible:ring-ring/50 flex h-8 min-w-0 items-center justify-center rounded-md px-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
                    active
                      ? 'bg-[color:var(--color-bg-default)] text-[color:var(--color-content-emphasis)] shadow-xs'
                      : 'text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)]',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
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

  function setLaunchSoundValue(value: boolean) {
    mutate((draft) => {
      const sound = ensureRecord(draft, 'sound');
      const mortar = ensureRecord(draft, 'mortar');
      sound.launch = value;
      mortar.sound = value;
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
      if (section === 'liftParticles' && String(key) !== 'appearanceMode') {
        target.appearanceMode = 'custom';
      }
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
      if (section === 'liftParticles') target.appearanceMode = 'custom';
    });
  }

  function renderBoomControl() {
    return (
      <Field>
        <div className="flex items-center gap-1.5">
          <FieldLabel>Burst report</FieldLabel>
          <InfoTooltip text="Explosion sound at the top, when the shell opens." />
        </div>
        <SelectField
          value={boomValue}
          onChange={(value) => setNestedRenderValue('sound', 'boom', value)}
          options={BOOM_OPTIONS}
          ariaLabel="Burst report"
          disabled={disabled}
        />
      </Field>
    );
  }

  function renderLaunchSoundControl() {
    return (
      <SwitchField
        label="Launch sound"
        checked={launchSoundValue}
        disabled={disabled}
        hint="Mortar lift sound when the shell leaves the tube."
        onChange={setLaunchSoundValue}
      />
    );
  }

  function renderLaunchShellParticleControls() {
    if (!showLaunch && controlScope !== 'launchShell') return null;

    const shell = design.launch.shell;
    const shellVisible = shell.visible;

    const content = (
      <div className={CONTROL_GRID_CLASS}>
        <SwitchField
          label="Show shell particle"
          checked={shellVisible}
          disabled={disabled}
          hint="Draw the rising carrier particle. Turning it off keeps the hidden physics carrier for timing and lift effects."
          onChange={(value) => setLaunchValue('shell', 'visible', value)}
        />
        <Field>
          <div className="flex items-center gap-1.5">
            <FieldLabel>Shell shape</FieldLabel>
            <InfoTooltip text="Shape of the visible carrier particle that rises before the burst." />
          </div>
          <SelectField
            value={shell.shape}
            onChange={(value) => setLaunchValue('shell', 'shape', value as LaunchShellShape)}
            options={LAUNCH_SHELL_SHAPE_OPTIONS}
            ariaLabel="Shell particle shape"
            disabled={disabled || !shellVisible}
          />
        </Field>
        <ColorField
          label="Shell colour"
          value={rgbObjectToHex(shell.colour)}
          allowClear
          disabled={disabled || !shellVisible}
          hint="Leave clear to inherit the warmed launch colour."
          onChange={(value) =>
            setLaunchValue('shell', 'colour', value ? hexToRgbObject(value) : undefined)
          }
        />
        <SliderField
          label="Shell size"
          min={LAUNCH_SHELL_SIZE_SCALE_MIN}
          max={LAUNCH_SHELL_SIZE_SCALE_MAX}
          step={0.05}
          value={shell.sizeScale}
          formatValue={formatMultiplier}
          showNumberInput
          inputAriaLabel="Shell particle size value"
          disabled={disabled || !shellVisible}
          hint="Size multiplier for the rising carrier particle."
          onChange={(value) => setLaunchValue('shell', 'sizeScale', round2(value))}
        />
        <SliderField
          label="Shell brightness"
          min={0}
          max={LAUNCH_SHELL_BRIGHTNESS_MAX}
          step={0.05}
          value={shell.brightness}
          formatValue={formatMultiplier}
          showNumberInput
          inputAriaLabel="Shell particle brightness value"
          disabled={disabled || !shellVisible}
          hint="Colour intensity of the rising carrier particle."
          onChange={(value) => setLaunchValue('shell', 'brightness', round2(value))}
        />
        <SliderField
          label="Shell glow"
          min={MIN_HEAD_GLOW_STRENGTH}
          max={MAX_HEAD_GLOW_STRENGTH}
          step={0.05}
          value={shell.glowStrength}
          formatValue={formatMultiplier}
          showNumberInput
          inputAriaLabel="Shell particle glow value"
          disabled={disabled || !shellVisible || shell.shape !== 'orb'}
          hint="Halo strength for the Soft orb shape."
          onChange={(value) => setLaunchValue('shell', 'glowStrength', round2(value))}
        />
      </div>
    );

    if (controlScope === 'launchShell') return content;

    return <SubSection title="Shell particle">{content}</SubSection>;
  }

  function renderLaunchShellTrailControls() {
    if (!showLaunch && controlScope !== 'launchTrail') return null;

    const shellTrail = design.launch.shell.trail;

    const content = (
      <div className={CONTROL_GRID_CLASS}>
        <SliderField
          label="Tube diameter"
          min={0}
          max={SHELL_TRAIL_TUBE_DIAMETER_MAX}
          step={1}
          value={shellTrail.tubeDiameter}
          showNumberInput
          inputAriaLabel="Shell trail tube diameter value"
          disabled={disabled}
          hint="Maximum diameter of the rising shell trail. 0 keeps particles on the exact shell path."
          onChange={(value) =>
            setLaunchNestedValue('shell', 'trail', 'tubeDiameter', round2(value))
          }
        />
        <SliderField
          label="Front angle"
          min={0}
          max={SHELL_TRAIL_SPREAD_ANGLE_MAX}
          step={1}
          value={shellTrail.frontAngle}
          formatValue={formatDegrees}
          showNumberInput
          inputAriaLabel="Shell trail front angle value"
          disabled={disabled}
          hint="Spread angle near the shell head of the rising streak. The tube diameter remains the hard cap."
          onChange={(value) => setLaunchNestedValue('shell', 'trail', 'frontAngle', round2(value))}
        />
        <SliderField
          label="Tail angle"
          min={0}
          max={SHELL_TRAIL_SPREAD_ANGLE_MAX}
          step={1}
          value={shellTrail.tailAngle}
          formatValue={formatDegrees}
          showNumberInput
          inputAriaLabel="Shell trail tail angle value"
          disabled={disabled}
          fullWidth
          hint="Spread angle in the older lift trail after it clears the mortar. The launch starts straight and the tube diameter remains the hard cap."
          onChange={(value) => setLaunchNestedValue('shell', 'trail', 'tailAngle', round2(value))}
        />
        <SliderField
          label="Width curve"
          min={SHELL_TRAIL_CURVE_MIN}
          max={SHELL_TRAIL_CURVE_MAX}
          step={0.05}
          value={shellTrail.curve}
          formatValue={formatMultiplier}
          showNumberInput
          inputAriaLabel="Shell trail width curve value"
          disabled={disabled}
          fullWidth
          hint="Shapes how quickly the shell trail widens from the launch tube towards its older tail."
          onChange={(value) => setLaunchNestedValue('shell', 'trail', 'curve', round2(value))}
        />
      </div>
    );

    if (controlScope === 'launchTrail') return content;

    return <SubSection title="Shell trail">{content}</SubSection>;
  }

  function renderLiftParticleControls() {
    if (!showLaunch) return null;

    const liftParticles = design.launch.liftParticles;
    const controlDisabled = sectionDisabled.liftParticles;
    const particleShape = shapeOptionFromWeights(liftParticles.shapeWeights);
    const liftBias = trailBiasFromFrontClump(liftParticles.frontClump);
    const supportsInheritedAppearance =
      isBrocade ||
      (design.stars.outer.enabled &&
        design.stars.outer.burstTrail.enabled &&
        design.stars.outer.burstTrail.particlesPerStar > 0);

    function setParticleShape(value: string) {
      const shape = value as TrailParticleShapeOption;
      const weights = TRAIL_PARTICLE_SHAPE_WEIGHTS[shape] ?? TRAIL_PARTICLE_SHAPE_WEIGHTS.square;
      setLaunchValue('liftParticles', 'shapeWeights', { ...weights });
    }

    return (
      <PanelSection
        title="Lift particles"
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
          {supportsInheritedAppearance ? (
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel>Particle appearance</FieldLabel>
                <InfoTooltip text="Match burst trail preserves the calibrated rising streak. Choosing Custom, or changing any lift-particle control, makes the settings below authoritative." />
              </div>
              <SelectField
                value={liftParticles.appearanceMode}
                onChange={(value) =>
                  setLaunchValue(
                    'liftParticles',
                    'appearanceMode',
                    value as FireworkDesign['launch']['liftParticles']['appearanceMode'],
                  )
                }
                options={LIFT_APPEARANCE_OPTIONS}
                ariaLabel="Lift particle appearance"
                disabled={disabled}
              />
            </Field>
          ) : null}
          <SubSection title="Particles">
            <div className={CONTROL_GRID_CLASS}>
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
                fullWidth
                hint="Global size for every lift particle before head and tail scaling."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'particleSize', 'base', round2(value))
                }
              />
              <AdvancedControls>
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
                    setLaunchNestedValue(
                      'liftParticles',
                      'particleSize',
                      'headScale',
                      round2(value),
                    )
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
                    setLaunchNestedValue(
                      'liftParticles',
                      'particleSize',
                      'tailScale',
                      round2(value),
                    )
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
              </AdvancedControls>
            </div>
          </SubSection>

          <SubSection title="Placement">
            <div className={CONTROL_GRID_CLASS}>
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
                label="Rise height"
                min={0}
                max={LIFT_PARTICLE_HEIGHT_PERCENT_MAX}
                step={1}
                value={liftParticles.height}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift rise height percent value"
                disabled={controlDisabled}
                hint="How far up the shell path lift particles climb. 0% stays at launch; 100% reaches the burst centre."
                onChange={(value) => setLaunchValue('liftParticles', 'height', round2(value))}
              />
              <AdvancedControls>
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
                  label="Cluster strength"
                  min={0}
                  max={100}
                  step={1}
                  value={liftParticles.spacing.clusterStrength}
                  formatValue={formatPercent}
                  showNumberInput
                  inputAriaLabel="Lift cluster strength value"
                  disabled={controlDisabled}
                  hint="Bunches the particle budget into brighter pockets along the loop."
                  onChange={(value) =>
                    setLaunchNestedValue(
                      'liftParticles',
                      'spacing',
                      'clusterStrength',
                      round2(value),
                    )
                  }
                />
                <SliderField
                  label="Path fill"
                  min={1}
                  max={LIFT_PATH_SAMPLES_MAX}
                  step={1}
                  value={liftParticles.spacing.pathSamples}
                  showNumberInput
                  inputAriaLabel="Lift path fill value"
                  disabled={controlDisabled}
                  hint="Subsamples the shell path between frames so lift particles form a smoother trail."
                  onChange={(value) =>
                    setLaunchNestedValue(
                      'liftParticles',
                      'spacing',
                      'pathSamples',
                      Math.round(value),
                    )
                  }
                />
              </AdvancedControls>
            </div>
          </SubSection>

          <SubSection title="Life and glow">
            <div className={CONTROL_GRID_CLASS}>
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
              <AdvancedControls>
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
                    setLaunchNestedValue(
                      'liftParticles',
                      'intensity',
                      'fadeSoftness',
                      round2(value),
                    )
                  }
                />
                <SliderField
                  label="Flicker chance"
                  min={0}
                  max={1}
                  step={0.01}
                  value={liftParticles.flicker.chance}
                  formatValue={formatProbability}
                  showNumberInput
                  inputAriaLabel="Lift flicker chance value"
                  disabled={controlDisabled}
                  hint="Chance each lift particle twinkles white-hot."
                  onChange={(value) =>
                    setLaunchNestedValue('liftParticles', 'flicker', 'chance', round2(value))
                  }
                />
                <SliderField
                  label="Flicker strength"
                  min={0}
                  max={LIFT_PARTICLE_FLICKER_STRENGTH_MAX}
                  step={0.05}
                  value={liftParticles.flicker.strength}
                  formatValue={formatMultiplier}
                  showNumberInput
                  inputAriaLabel="Lift flicker strength value"
                  disabled={controlDisabled}
                  hint="How strongly a flickering particle flashes towards white."
                  onChange={(value) =>
                    setLaunchNestedValue('liftParticles', 'flicker', 'strength', round2(value))
                  }
                />
                <SliderField
                  label="Flicker life"
                  min={0}
                  max={BURST_TRAIL_FLICKER_LIFE_MAX}
                  step={0.01}
                  value={liftParticles.flicker.lifetimeMultiplier}
                  formatValue={formatMultiplier}
                  showNumberInput
                  inputAriaLabel="Lift flicker life value"
                  disabled={controlDisabled}
                  hint="Lifetime multiplier for particles that flicker. Lower values create sharper flashes."
                  onChange={(value) =>
                    setLaunchNestedValue(
                      'liftParticles',
                      'flicker',
                      'lifetimeMultiplier',
                      round2(value),
                    )
                  }
                />
              </AdvancedControls>
            </div>
          </SubSection>

          <SubSection title="Motion">
            <div className={CONTROL_GRID_CLASS}>
              <SliderField
                label="Ascent swirl"
                min={0}
                max={LIFT_SWIRL_STRENGTH_MAX}
                step={0.05}
                value={liftParticles.motion.swirlStrength}
                showNumberInput
                inputAriaLabel="Lift ascent swirl value"
                disabled={controlDisabled}
                hint="Curves the shell sideways as it rises, making the lift trail corkscrew."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'swirlStrength', round2(value))
                }
              />
              <SliderField
                label="Swirl radius"
                min={0}
                max={LIFT_SWIRL_RADIUS_MAX}
                step={1}
                value={liftParticles.motion.swirlRadius}
                showNumberInput
                inputAriaLabel="Lift swirl radius value"
                disabled={controlDisabled}
                hint="Visible radius of the lift particles around the rising shell path."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'swirlRadius', round2(value))
                }
              />
              <SliderField
                label="Loop count"
                min={0}
                max={LIFT_SWIRL_LOOP_COUNT_MAX}
                step={0.1}
                value={liftParticles.motion.swirlLoopCount}
                formatValue={formatLoopCount}
                showNumberInput
                inputAriaLabel="Lift loop count value"
                disabled={controlDisabled}
                hint="How many full loopdy-loop turns the lift path draws after it clears the mortar."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'swirlLoopCount', round2(value))
                }
              />
              <SliderField
                label="Loop length"
                min={LIFT_SWIRL_LOOP_LENGTH_MIN}
                max={LIFT_SWIRL_LOOP_LENGTH_MAX}
                step={1}
                value={liftParticles.motion.swirlLoopLength}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift loop length value"
                disabled={controlDisabled}
                hint="How much of the rise is used for the loop section. Shorter lengths make tighter arcs."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'swirlLoopLength', round2(value))
                }
              />
              <SliderField
                label="Loop height"
                min={0}
                max={LIFT_SWIRL_LOOP_HEIGHT_MAX}
                step={1}
                value={liftParticles.motion.swirlLoopHeight}
                showNumberInput
                inputAriaLabel="Lift loop height value"
                disabled={controlDisabled}
                hint="Adds a flat vertical curl after the lift clears the mortar."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'swirlLoopHeight', round2(value))
                }
              />
              <SliderField
                label="Loop speed"
                min={0}
                max={LIFT_SWIRL_RATE_MAX}
                step={0.1}
                value={liftParticles.motion.swirlRate}
                formatValue={formatTurns}
                showNumberInput
                inputAriaLabel="Lift loop speed value"
                disabled={controlDisabled}
                hint="How quickly the loop phase rotates over time. Keep this low for slow loopdy-loop launches."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'swirlRate', round2(value))
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
              <AdvancedControls>
                <SliderField
                  label="Gravity"
                  min={LIFT_PARTICLE_GRAVITY_MIN}
                  max={LIFT_PARTICLE_GRAVITY_MAX}
                  step={0.01}
                  value={liftParticles.motion.gravity}
                  showNumberInput
                  inputAriaLabel="Lift gravity value"
                  disabled={controlDisabled}
                  hint="Vertical acceleration after a particle leaves the guided shell path."
                  onChange={(value) =>
                    setLaunchNestedValue('liftParticles', 'motion', 'gravity', round2(value))
                  }
                />
                <SliderField
                  label="Drag"
                  min={0}
                  max={LIFT_PARTICLE_DRAG_MAX}
                  step={0.05}
                  value={liftParticles.motion.drag}
                  showNumberInput
                  inputAriaLabel="Lift drag value"
                  disabled={controlDisabled}
                  hint="Air resistance on released lift particles. Higher values stop their motion sooner."
                  onChange={(value) =>
                    setLaunchNestedValue('liftParticles', 'motion', 'drag', round2(value))
                  }
                />
                <SliderField
                  label="Inherited speed"
                  min={0}
                  max={LIFT_PARTICLE_INHERITED_VELOCITY_MAX}
                  step={0.01}
                  value={liftParticles.motion.inheritedVelocity}
                  formatValue={formatProbability}
                  showNumberInput
                  inputAriaLabel="Lift inherited speed value"
                  disabled={controlDisabled}
                  hint="Share of the shell's velocity retained when each lift particle is released."
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
                  max={LIFT_PARTICLE_TURBULENCE_MAX}
                  step={0.01}
                  value={liftParticles.motion.turbulence}
                  showNumberInput
                  inputAriaLabel="Lift turbulence value"
                  disabled={controlDisabled}
                  hint="Random velocity scatter that roughens the launch trail."
                  onChange={(value) =>
                    setLaunchNestedValue('liftParticles', 'motion', 'turbulence', round2(value))
                  }
                />
              </AdvancedControls>
            </div>
          </SubSection>
        </div>
      </PanelSection>
    );
  }

  function renderSmokeControls() {
    if (!showLaunch && controlScope !== 'smoke') return null;

    const smoke = design.launch.smoke;
    const smokeContent = (
      <div className={CONTROL_GRID_CLASS}>
        <ColorField
          label="Smoke colour"
          value={rgbObjectToHex(smoke.colour) ?? '#8f9298'}
          disabled={sectionDisabled.smoke}
          hint="Tint used by both mortar smoke and the puffs emitted along the rising shell path."
          onChange={(value) =>
            setLaunchValue('smoke', 'colour', hexToRgbObject(value ?? '#8f9298'))
          }
        />
        <SliderField
          label="Smoke opacity"
          min={0}
          max={1}
          step={0.01}
          value={smoke.opacity}
          formatValue={formatProbability}
          showNumberInput
          inputAriaLabel="Smoke opacity value"
          disabled={sectionDisabled.smoke}
          hint="Maximum opacity of a fresh smoke puff before it begins fading."
          onChange={(value) => setLaunchValue('smoke', 'opacity', round2(value))}
        />
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
        <AdvancedControls>
          <SliderField
            label="Size variation"
            min={0}
            max={100}
            step={1}
            value={smoke.sizeVariationPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Smoke size variation value"
            disabled={sectionDisabled.smoke}
            hint="Seeded difference between the smallest and largest smoke puffs."
            onChange={(value) => setLaunchValue('smoke', 'sizeVariationPercent', round2(value))}
          />
          <SliderField
            label="Life variation"
            min={0}
            max={100}
            step={1}
            value={smoke.lifeVariationPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Smoke life variation value"
            disabled={sectionDisabled.smoke}
            hint="Seeded variation in how long individual puffs remain visible."
            onChange={(value) => setLaunchValue('smoke', 'lifeVariationPercent', round2(value))}
          />
          <SliderField
            label="Expansion"
            min={-120}
            max={240}
            step={1}
            value={smoke.expansionPerSecond}
            showNumberInput
            inputAriaLabel="Smoke expansion value"
            disabled={sectionDisabled.smoke}
            hint="Change in puff size per second. Negative values contract; positive values billow outward."
            onChange={(value) => setLaunchValue('smoke', 'expansionPerSecond', round2(value))}
          />
          <SliderField
            label="Wind X"
            min={-4}
            max={4}
            step={0.05}
            value={smoke.windX}
            showNumberInput
            inputAriaLabel="Smoke horizontal wind value"
            disabled={sectionDisabled.smoke}
            hint="Constant sideways wind. Negative moves left; positive moves right."
            onChange={(value) => setLaunchValue('smoke', 'windX', round2(value))}
          />
          <SliderField
            label="Wind depth"
            min={-4}
            max={4}
            step={0.05}
            value={smoke.windZ}
            showNumberInput
            inputAriaLabel="Smoke depth wind value"
            disabled={sectionDisabled.smoke}
            hint="Constant front-to-back wind through the smoke column."
            onChange={(value) => setLaunchValue('smoke', 'windZ', round2(value))}
          />
          <SliderField
            label="Turbulence"
            min={0}
            max={4}
            step={0.05}
            value={smoke.turbulence}
            showNumberInput
            inputAriaLabel="Smoke turbulence value"
            disabled={sectionDisabled.smoke}
            hint="Curling noise applied over time. Higher values make the column more chaotic."
            onChange={(value) => setLaunchValue('smoke', 'turbulence', round2(value))}
          />
        </AdvancedControls>
      </div>
    );

    if (controlScope === 'smoke') {
      return (
        <div className="space-y-4">
          <SwitchField
            label="Smoke"
            checked={smokeEnabled}
            disabled={disabled}
            hint="Launch smoke from the mortar and rising shell path."
            onChange={(value) => setLaunchValue('smoke', 'enabled', value)}
          />
          <div className={cn(!smokeEnabled && 'opacity-55')}>{smokeContent}</div>
        </div>
      );
    }

    return (
      <PanelSection
        title="Smoke"
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
        {smokeContent}
      </PanelSection>
    );
  }

  function ensureDraftStarLayer(draft: JsonRecord, layerKey: StarLayerKey) {
    const stars = ensureRecord(draft, 'stars');
    return ensureRecord(stars, layerKey);
  }

  function ensureDraftStarNested(
    draft: JsonRecord,
    layerKey: StarLayerKey,
    group: 'burst' | 'head',
  ) {
    const layer = ensureDraftStarLayer(draft, layerKey);
    return ensureRecord(layer, group);
  }

  function normaliseStarCount(value: number) {
    return Math.min(STAR_COUNT_MAX, Math.max(STAR_COUNT_MIN, Math.round(value)));
  }

  function setBurstRangeMid(key: 'speed' | 'gravity' | 'life', mid: number, halfWidth: number) {
    mutate((draft) => {
      const next =
        key === 'gravity'
          ? boundedRangeFromMidpoint(mid, halfWidth, STAR_GRAVITY_MIN, STAR_GRAVITY_MAX)
          : key === 'life'
            ? lifeRangeFromMidAndHalfWidth(mid, halfWidth)
            : boundedRangeFromMidpoint(mid, halfWidth, STAR_SPEED_MIN, STAR_SPEED_MAX);
      const burst = ensureRecord(draft, 'burst');
      burst[key] = next;
      if (isBrocade) ensureDraftStarNested(draft, 'outer', 'burst')[key] = next;
    });
  }

  function setBrocadeGravityUpper(maxGravity: number) {
    const spread = Math.abs(design.burst.gravity[1] - design.burst.gravity[0]);
    mutate((draft) => {
      const upper = clampNumber(maxGravity, STAR_GRAVITY_MIN, STAR_GRAVITY_MAX);
      const next = [round2(Math.max(STAR_GRAVITY_MIN, upper - spread)), round2(upper)];
      const burst = ensureRecord(draft, 'burst');
      burst.gravity = next;
      if (isBrocade) ensureDraftStarNested(draft, 'outer', 'burst').gravity = next;
    });
  }

  function setBrocadeValue(key: string, value: unknown) {
    mutate((draft) => {
      const brocade = ensureRecord(draft, 'brocade');
      brocade[key] = value;
      if (key === 'headsEnabled') ensureDraftStarLayer(draft, 'outer').enabled = value;
      if (key === 'headSize') ensureDraftStarNested(draft, 'outer', 'head').size = value;
      if (key === 'glowStrength')
        ensureDraftStarNested(draft, 'outer', 'head').glowStrength = value;
    });
  }

  function setBrocadeColour(
    group: 'headColors' | 'palette',
    key: 'green' | 'red' | 'hot' | 'ember',
    value: string | null,
  ) {
    if (!value) return;
    mutate((draft) => {
      const brocade = ensureRecord(draft, 'brocade');
      ensureRecord(brocade, group)[key] = hexToRgbObject(value);
    });
  }

  function setStarLayerEnabled(layerKey: StarLayerKey, value: boolean) {
    mutate((draft) => {
      ensureDraftStarLayer(draft, layerKey).enabled = value;
      if (isBrocade && layerKey === 'outer') {
        const brocade = ensureRecord(draft, 'brocade');
        brocade.headsEnabled = value;
      }
    });
  }

  function setStarCount(layerKey: StarLayerKey, value: number) {
    const count = normaliseStarCount(value);
    mutate((draft) => {
      ensureDraftStarLayer(draft, layerKey).count = count;
      if (isBrocade && layerKey === 'outer') {
        const brocade = ensureRecord(draft, 'brocade');
        brocade.streakCount = count;
      }
    });
  }

  function setLayerNestedValue(
    layerKey: StarLayerKey,
    group: 'burst' | 'head',
    key: string,
    value: unknown,
  ) {
    mutate((draft) => {
      const layer = ensureDraftStarLayer(draft, layerKey);
      const target = ensureRecord(layer, group);
      target[key] = value;
    });
  }

  function setStarLayerColour(layerKey: StarLayerKey, value: string | null) {
    mutate((draft) => {
      const layer = ensureDraftStarLayer(draft, layerKey);
      if (value) layer.color = hexToRgbObject(value);
      else delete layer.color;
    });
  }

  function setStarColourPatternValue(
    layerKey: StarLayerKey,
    key: 'mode' | 'axis' | 'count',
    value: unknown,
  ) {
    mutate((draft) => {
      const pattern = ensureRecord(ensureDraftStarLayer(draft, layerKey), 'colourPattern');
      pattern[key] = value;
      if (
        key === 'mode' &&
        value !== 'solid' &&
        design.stars[layerKey].colourPattern.colours.length === 0
      ) {
        pattern.colours = [
          { color: { r: 1, g: 0.84, b: 0.4 }, weight: 100 },
          { color: { r: 1, g: 0.32, b: 0.12 }, weight: 100 },
        ];
      }
    });
  }

  function setStarColourPatternEntries(layerKey: StarLayerKey, entries: StarColourPatternEntry[]) {
    mutate((draft) => {
      const pattern = ensureRecord(ensureDraftStarLayer(draft, layerKey), 'colourPattern');
      pattern.colours = entries;
    });
  }

  function updateStarColourPatternEntry(
    layerKey: StarLayerKey,
    index: number,
    patch: Partial<StarColourPatternEntry>,
  ) {
    const entries = design.stars[layerKey].colourPattern.colours.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, ...patch } : entry,
    );
    setStarColourPatternEntries(layerKey, entries);
  }

  function addStarColourPatternEntry(layerKey: StarLayerKey) {
    const entries = design.stars[layerKey].colourPattern.colours;
    if (entries.length >= STAR_COLOUR_PATTERN_MAX_COLOURS) return;
    const fallbackColours = ['#ffd666', '#ff6b14', '#67e8f9', '#f472b6'];
    setStarColourPatternEntries(layerKey, [
      ...entries,
      {
        color: hexToRgbObject(
          fallbackColours[entries.length % fallbackColours.length] ?? '#ffd666',
        ),
        weight: 100,
      },
    ]);
  }

  function removeStarColourPatternEntry(layerKey: StarLayerKey, index: number) {
    setStarColourPatternEntries(
      layerKey,
      design.stars[layerKey].colourPattern.colours.filter((_, entryIndex) => entryIndex !== index),
    );
  }

  function setStarBurstRangeMid(
    layerKey: StarLayerKey,
    key: 'speed' | 'gravity' | 'life',
    mid: number,
    halfWidth: number,
  ) {
    if (isBrocade && layerKey === 'outer') {
      setBurstRangeMid(key, mid, halfWidth);
      return;
    }
    setLayerBurstRangeMid(layerKey, key, mid, halfWidth);
  }

  function setStarBurstLifeMid(layerKey: StarLayerKey, mid: number) {
    if (isBrocade && layerKey === 'outer') {
      setBurstRangeMid('life', mid, rangeHalfWidth(design.burst.life));
      return;
    }
    setLayerBurstLifeMid(layerKey, mid);
  }

  function setStarGravityUpper(layerKey: StarLayerKey, maxGravity: number) {
    if (isBrocade && layerKey === 'outer') {
      setBrocadeGravityUpper(maxGravity);
      return;
    }
    setLayerGravityUpper(layerKey, maxGravity);
  }

  function setStarSpeedSpread(layerKey: StarLayerKey, halfWidth: number) {
    const burst = isBrocade && layerKey === 'outer' ? design.burst : design.stars[layerKey].burst;
    setStarBurstRangeMid(layerKey, 'speed', rangeMid(burst.speed), halfWidth);
  }

  function setStarGravitySpread(layerKey: StarLayerKey, spread: number) {
    const burst = isBrocade && layerKey === 'outer' ? design.burst : design.stars[layerKey].burst;
    const upper = rangeUpper(burst.gravity);
    const next: [number, number] = [
      round2(Math.max(STAR_GRAVITY_MIN, upper - spread)),
      round2(upper),
    ];
    mutate((draft) => {
      const target =
        isBrocade && layerKey === 'outer'
          ? ensureRecord(draft, 'burst')
          : ensureDraftStarNested(draft, layerKey, 'burst');
      target.gravity = next;
      if (isBrocade && layerKey === 'outer') {
        ensureDraftStarNested(draft, 'outer', 'burst').gravity = next;
      }
    });
  }

  function setStarBurstScalar(
    layerKey: StarLayerKey,
    key: 'airResistancePercent' | 'terminalVelocity',
    value: number,
  ) {
    const maximum =
      key === 'airResistancePercent' ? STAR_AIR_RESISTANCE_PERCENT_MAX : STAR_TERMINAL_VELOCITY_MAX;
    const next = round2(clampNumber(value, 0, maximum));
    mutate((draft) => {
      const layerBurst = ensureDraftStarNested(draft, layerKey, 'burst');
      layerBurst[key] = next;
      if (isBrocade && layerKey === 'outer') {
        ensureRecord(draft, 'burst')[key] = next;
      }
    });
  }

  function setStarHeadSize(layerKey: StarLayerKey, value: number) {
    mutate((draft) => {
      ensureDraftStarNested(draft, layerKey, 'head').size = value;
      if (isBrocade && layerKey === 'outer') {
        const brocade = ensureRecord(draft, 'brocade');
        brocade.headSize = value;
      }
    });
  }

  function setStarHeadVisible(layerKey: StarLayerKey, value: boolean) {
    mutate((draft) => {
      ensureDraftStarNested(draft, layerKey, 'head').visible = value;
      if (isBrocade && layerKey === 'outer') {
        const brocade = ensureRecord(draft, 'brocade');
        brocade.headsEnabled = value;
      }
    });
  }

  function setStarGlowStrength(layerKey: StarLayerKey, value: number) {
    const strength = round2(value);
    mutate((draft) => {
      ensureDraftStarNested(draft, layerKey, 'head').glowStrength = strength;
      if (isBrocade && layerKey === 'outer') {
        const brocade = ensureRecord(draft, 'brocade');
        brocade.glowStrength = strength;
      }
    });
  }

  function setLayerHeadOpeningValue(
    layerKey: StarLayerKey,
    section: keyof StarHeadOpening,
    key: string,
    value: unknown,
  ) {
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      const head = ensureRecord(layer, 'head');
      const opening = ensureRecord(head, 'opening');
      const target = ensureRecord(opening, String(section));
      target[key] = value;
    });
  }

  function setLayerHeadClosingValue(
    layerKey: StarLayerKey,
    section: keyof StarHeadClosing,
    key: string,
    value: unknown,
  ) {
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      const head = ensureRecord(layer, 'head');
      const closing = ensureRecord(head, 'closing');
      const target = ensureRecord(closing, String(section));
      target[key] = value;
    });
  }

  function setLayerBurstLifeMid(layerKey: StarLayerKey, mid: number) {
    const halfWidth = rangeHalfWidth(design.stars[layerKey].burst.life);
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      const burst = ensureRecord(layer, 'burst');
      burst.life = lifeRangeFromMidAndHalfWidth(mid, halfWidth);
    });
  }

  function setLayerBurstLifeHalfWidth(layerKey: StarLayerKey, halfWidth: number) {
    const mid = rangeMid(design.stars[layerKey].burst.life);
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      const burst = ensureRecord(layer, 'burst');
      burst.life = lifeRangeFromMidAndHalfWidth(mid, halfWidth);
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
      burst[key] =
        key === 'gravity'
          ? boundedRangeFromMidpoint(mid, halfWidth, STAR_GRAVITY_MIN, STAR_GRAVITY_MAX)
          : key === 'life'
            ? lifeRangeFromMidAndHalfWidth(mid, halfWidth)
            : boundedRangeFromMidpoint(mid, halfWidth, STAR_SPEED_MIN, STAR_SPEED_MAX);
    });
  }

  function setLayerGravityUpper(layerKey: StarLayerKey, maxGravity: number) {
    const current = design.stars[layerKey].burst.gravity;
    const spread = Math.abs(current[1] - current[0]);
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey);
      const burst = ensureRecord(layer, 'burst');
      const upper = clampNumber(maxGravity, STAR_GRAVITY_MIN, STAR_GRAVITY_MAX);
      burst.gravity = [round2(Math.max(STAR_GRAVITY_MIN, upper - spread)), round2(upper)];
    });
  }

  function renderStarColourPatternControls(layerKey: StarLayerKey, controlDisabled: boolean) {
    const layer = design.stars[layerKey];
    const pattern = layer.colourPattern;
    const positionalPattern = pattern.mode === 'bands' || pattern.mode === 'stripes';

    return (
      <SubSection title="Colour pattern">
        <div className="space-y-4">
          <div className={CONTROL_GRID_CLASS}>
            <ColorField
              label="Base colour"
              value={rgbObjectToHex(layer.color)}
              allowClear
              disabled={controlDisabled}
              hint="Leave clear to inherit the firework's accent colour. Pattern colours override it where configured."
              onChange={(value) => setStarLayerColour(layerKey, value)}
            />
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel>Pattern</FieldLabel>
                <InfoTooltip text="Solid uses the base colour. Random mixes the palette per star; bands and stripes place it across the burst." />
              </div>
              <SelectField
                value={pattern.mode}
                onChange={(value) => setStarColourPatternValue(layerKey, 'mode', value)}
                options={[...STAR_COLOUR_PATTERN_OPTIONS]}
                ariaLabel="Star Inner colour pattern"
                disabled={controlDisabled}
              />
            </Field>
            {positionalPattern ? (
              <>
                <Field>
                  <div className="flex items-center gap-1.5">
                    <FieldLabel>Direction</FieldLabel>
                    <InfoTooltip text="Direction used to place the colour bands or stripes across the burst." />
                  </div>
                  <SelectField
                    value={pattern.axis}
                    onChange={(value) => setStarColourPatternValue(layerKey, 'axis', value)}
                    options={[...STAR_COLOUR_AXIS_OPTIONS]}
                    ariaLabel="Star Inner colour pattern direction"
                    disabled={controlDisabled}
                  />
                </Field>
                <SliderField
                  label={pattern.mode === 'bands' ? 'Band count' : 'Stripe count'}
                  min={1}
                  max={6}
                  step={1}
                  value={pattern.count}
                  showNumberInput
                  inputAriaLabel="Star Inner colour pattern count"
                  disabled={controlDisabled}
                  hint="How often the palette repeats across this inner layer."
                  onChange={(value) =>
                    setStarColourPatternValue(
                      layerKey,
                      'count',
                      Math.min(6, Math.max(1, Math.round(value))),
                    )
                  }
                />
              </>
            ) : null}
          </div>

          {pattern.mode !== 'solid' ? (
            <div className="space-y-3">
              {pattern.colours.length > 0 ? (
                pattern.colours.map((entry, index) => (
                  <div
                    key={`${layerKey}-pattern-colour-${index}`}
                    className="space-y-3 rounded-lg border border-[color:var(--color-border-subtle)] p-3"
                  >
                    <div className={CONTROL_GRID_CLASS}>
                      <ColorField
                        label={`Palette colour ${index + 1}`}
                        value={rgbObjectToHex(entry.color) ?? '#ffffff'}
                        disabled={controlDisabled}
                        hint="Colour available to this pattern."
                        onChange={(value) => {
                          if (!value) return;
                          updateStarColourPatternEntry(layerKey, index, {
                            color: hexToRgbObject(value),
                          });
                        }}
                      />
                      <SliderField
                        label="Weight"
                        min={0}
                        max={100}
                        step={1}
                        value={entry.weight}
                        formatValue={formatPercent}
                        showNumberInput
                        inputAriaLabel={`Palette colour ${index + 1} weight`}
                        disabled={controlDisabled}
                        hint="Relative share of this colour when the pattern selects from the palette."
                        onChange={(value) =>
                          updateStarColourPatternEntry(layerKey, index, {
                            weight: Math.min(100, Math.max(0, Math.round(value))),
                          })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-[color:var(--color-content-subtle)] underline-offset-2 hover:text-[color:var(--color-content-emphasis)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={controlDisabled}
                      onClick={() => removeStarColourPatternEntry(layerKey, index)}
                    >
                      Remove colour
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-relaxed text-[color:var(--color-content-muted)]">
                  Add at least one palette colour for this pattern.
                </p>
              )}
              <button
                type="button"
                className="min-h-9 rounded-lg border border-[color:var(--color-border-default)] px-3 text-sm font-medium text-[color:var(--color-content-emphasis)] transition-colors hover:bg-[color:var(--color-bg-subtle)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  controlDisabled || pattern.colours.length >= STAR_COLOUR_PATTERN_MAX_COLOURS
                }
                onClick={() => addStarColourPatternEntry(layerKey)}
              >
                Add colour
              </button>
            </div>
          ) : null}
        </div>
      </SubSection>
    );
  }

  function renderStarOpeningControls(layerKey: StarLayerKey, controlDisabled: boolean) {
    const opening = design.stars[layerKey].head.opening;
    const colourEnabled = opening.colour.enabled;
    const sizeEnabled = opening.size.enabled;

    return (
      <SubSection title="Opening">
        <div className={CONTROL_GRID_CLASS}>
          <SwitchField
            label="Colour fade"
            checked={colourEnabled}
            disabled={controlDisabled}
            hint="Starts orange, then reaches the star colour over a percentage of this star's burn time."
            onChange={(value) => setLayerHeadOpeningValue(layerKey, 'colour', 'enabled', value)}
          />
          <SwitchField
            label="Size growth"
            checked={sizeEnabled}
            disabled={controlDisabled}
            hint="Starts smaller, then reaches the full star size over a percentage of this star's burn time."
            onChange={(value) => setLayerHeadOpeningValue(layerKey, 'size', 'enabled', value)}
          />
          <ColorField
            label="Opening colour"
            value={rgbObjectToHex(opening.colour.color) ?? STAR_OPENING_COLOUR_HEX}
            disabled={controlDisabled || !colourEnabled}
            hint="Colour used at the instant this star opens."
            onChange={(value) =>
              setLayerHeadOpeningValue(
                layerKey,
                'colour',
                'color',
                hexToRgbObject(value ?? STAR_OPENING_COLOUR_HEX),
              )
            }
          />
          <SliderField
            label="Colour fade time"
            min={STAR_OPENING_PERCENT_MIN}
            max={STAR_OPENING_PERCENT_MAX}
            step={1}
            value={opening.colour.fadePercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Colour fade time value"
            disabled={controlDisabled || !colourEnabled}
            hint="How much of the star's life is spent fading from the opening colour into the final colour."
            onChange={(value) =>
              setLayerHeadOpeningValue(layerKey, 'colour', 'fadePercent', round2(value))
            }
          />
          <SliderField
            label="Start size"
            min={STAR_OPENING_PERCENT_MIN}
            max={STAR_OPENING_PERCENT_MAX}
            step={1}
            value={opening.size.startPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Start size value"
            disabled={controlDisabled || !sizeEnabled}
            hint="Star size at the instant it opens, as a percentage of the final star size."
            onChange={(value) =>
              setLayerHeadOpeningValue(layerKey, 'size', 'startPercent', round2(value))
            }
          />
          <SliderField
            label="Grow time"
            min={STAR_OPENING_PERCENT_MIN}
            max={STAR_OPENING_PERCENT_MAX}
            step={1}
            value={opening.size.growPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Grow time value"
            disabled={controlDisabled || !sizeEnabled}
            hint="How much of the star's life is spent growing to the full star size."
            onChange={(value) =>
              setLayerHeadOpeningValue(layerKey, 'size', 'growPercent', round2(value))
            }
          />
        </div>
      </SubSection>
    );
  }

  function renderStarClosingControls(layerKey: StarLayerKey, controlDisabled: boolean) {
    const layer = design.stars[layerKey];
    const closing = layer.head.closing;
    const colourEnabled = closing.colour.enabled;
    const sizeEnabled = closing.size.enabled;

    return (
      <SubSection title="Closing">
        <div className={CONTROL_GRID_CLASS}>
          <SliderField
            label="Burn time"
            min={STAR_LIFE_MIN}
            max={STAR_LIFE_MAX}
            step={0.05}
            value={round2(rangeMid(layer.burst.life))}
            formatValue={formatSeconds}
            showNumberInput
            inputAriaLabel="Burn time value"
            disabled={controlDisabled}
            hint="How long stars in this layer stay alive before the closing fade finishes."
            onChange={(value) => setLayerBurstLifeMid(layerKey, value)}
          />
          <SliderField
            label="Burn spread"
            min={0}
            max={Math.max(
              0,
              Math.min(
                rangeMid(layer.burst.life) - STAR_LIFE_MIN,
                STAR_LIFE_MAX - rangeMid(layer.burst.life),
              ),
            )}
            step={0.05}
            value={round2(rangeHalfWidth(layer.burst.life))}
            formatValue={formatLifeVariation}
            showNumberInput
            inputAriaLabel="Burn spread value"
            disabled={controlDisabled}
            hint="Random spread around the burn time. 0 makes every star in this layer die together."
            onChange={(value) => setLayerBurstLifeHalfWidth(layerKey, round2(value))}
          />
          <SwitchField
            label="Fade colour"
            checked={colourEnabled}
            disabled={controlDisabled}
            hint="Fade each star into a chosen colour at the end instead of using the automatic late colour shift."
            onChange={(value) => setLayerHeadClosingValue(layerKey, 'colour', 'enabled', value)}
          />
          <SwitchField
            label="Size close"
            checked={sizeEnabled}
            disabled={controlDisabled}
            hint="Shrink or hold each star through the final part of its burn."
            onChange={(value) => setLayerHeadClosingValue(layerKey, 'size', 'enabled', value)}
          />
          {colourEnabled ? (
            <>
              <ColorField
                label="Closing colour"
                value={rgbObjectToHex(closing.colour.color) ?? STAR_CLOSING_COLOUR_HEX}
                disabled={controlDisabled}
                hint="Colour the star reaches as it dies."
                onChange={(value) =>
                  setLayerHeadClosingValue(
                    layerKey,
                    'colour',
                    'color',
                    hexToRgbObject(value ?? STAR_CLOSING_COLOUR_HEX),
                  )
                }
              />
              <SliderField
                label="Colour close time"
                min={STAR_CLOSING_PERCENT_MIN}
                max={STAR_CLOSING_PERCENT_MAX}
                step={1}
                value={closing.colour.fadePercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Closing colour fade time value"
                disabled={controlDisabled}
                hint="How much of the star's life is spent fading into the closing colour."
                onChange={(value) =>
                  setLayerHeadClosingValue(layerKey, 'colour', 'fadePercent', round2(value))
                }
              />
            </>
          ) : null}
          {sizeEnabled ? (
            <>
              <SliderField
                label="Final size"
                min={STAR_CLOSING_END_PERCENT_MIN}
                max={STAR_CLOSING_END_PERCENT_MAX}
                step={1}
                value={closing.size.endPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Final size value"
                disabled={controlDisabled}
                hint="Star size at the moment it dies, as a percentage of the full star size."
                onChange={(value) =>
                  setLayerHeadClosingValue(layerKey, 'size', 'endPercent', round2(value))
                }
              />
              <SliderField
                label="Shrink time"
                min={STAR_CLOSING_PERCENT_MIN}
                max={STAR_CLOSING_PERCENT_MAX}
                step={1}
                value={closing.size.shrinkPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Shrink time value"
                disabled={controlDisabled}
                hint="How much of the star's life is spent shrinking into the final size."
                onChange={(value) =>
                  setLayerHeadClosingValue(layerKey, 'size', 'shrinkPercent', round2(value))
                }
              />
            </>
          ) : null}
        </div>
      </SubSection>
    );
  }

  /**
   * Full head-orb appearance controls, shared by star layers and the brocade
   * "Heads" panel. Star values are saved on the selected layer's `head` object
   * and feed the live preview through the editor's `headStyle` / `renderTuning`
   * props. Grouped into Opening, Closing, Core, and Glow so the richer set stays
   * readable.
   */
  function renderStarAppearance(
    layerKey: StarLayerKey,
    controlDisabled: boolean,
    leadingControls?: ReactNode,
    showOpeningControls = true,
  ) {
    const heads = design.stars[layerKey].head;
    return (
      <div className="space-y-2.5">
        {leadingControls}
        {showOpeningControls ? renderStarOpeningControls(layerKey, controlDisabled) : null}
        {showOpeningControls ? renderStarClosingControls(layerKey, controlDisabled) : null}
        <SubSection title="Brightness curve">
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              label="Brightness hold"
              min={MIN_BRIGHTNESS_HOLD_PERCENT}
              max={MAX_BRIGHTNESS_HOLD_PERCENT}
              step={1}
              value={heads.brightnessHoldPercent}
              formatValue={formatPercent}
              showNumberInput
              inputAriaLabel="Star brightness hold value"
              disabled={controlDisabled}
              hint="Percentage of the star's life held at full brightness before its final fade begins."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'brightnessHoldPercent', round2(value))
              }
            />
            <SliderField
              label="Fade exponent"
              min={MIN_BRIGHTNESS_HOLD_EXPONENT}
              max={MAX_BRIGHTNESS_HOLD_EXPONENT}
              step={0.05}
              value={heads.brightnessHoldExponent}
              formatValue={formatMultiplier}
              showNumberInput
              inputAriaLabel="Star brightness fade exponent value"
              disabled={controlDisabled}
              hint="Shape of the post-hold fade. Higher values keep the star brighter before a sharper wink-out."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'brightnessHoldExponent', round2(value))
              }
            />
          </div>
        </SubSection>
        <SubSection title="Core">
          <div className={CONTROL_GRID_CLASS}>
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
              fullWidth
              hint="Opacity falloff for the coloured core. 0% keeps the edge solid; higher fades the core into the surrounding glow."
              onChange={(value) =>
                setLayerNestedValue(layerKey, 'head', 'coreOpacityFalloff', value)
              }
            />
          </div>
        </SubSection>
        <SubSection title="Glow">
          <div className={CONTROL_GRID_CLASS}>
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
              fullWidth
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
        const stars = draft.stars;
        if (isRecord(stars) && isRecord(stars.outer)) delete stars.outer.burstTrail;
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
  >(layerKey: StarLayerKey | undefined, section: T, key: keyof BurstTrail[T], value: unknown) {
    patchBurstTrail(layerKey, (trail) => ({
      ...trail,
      [section]: {
        ...trail[section],
        [key]: value,
      },
    }));
  }

  function setBurstTrailOpeningValue(
    layerKey: StarLayerKey | undefined,
    section: keyof BurstTrailOpening,
    key: string,
    value: unknown,
  ) {
    patchBurstTrail(layerKey, (trail) => ({
      ...trail,
      opening: {
        ...trail.opening,
        [section]: {
          ...trail.opening[section],
          [key]: value,
        },
      },
    }));
  }

  function setBurstTrailClosingValue(
    layerKey: StarLayerKey | undefined,
    section: keyof BurstTrailClosing,
    key: string,
    value: unknown,
  ) {
    patchBurstTrail(layerKey, (trail) => ({
      ...trail,
      closing: {
        ...trail.closing,
        [section]: {
          ...trail.closing[section],
          [key]: value,
        },
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
    const count = normaliseStarCount(value);
    mutate((draft) => {
      const brocade = ensureRecord(draft, 'brocade');
      brocade.streakCount = count;
      ensureDraftStarLayer(draft, 'outer').count = count;
    });
  }

  function renderBurstTrailOpeningControls(layerKey: StarLayerKey | undefined) {
    const trail = currentBurstTrail(layerKey);
    const opening = trail.opening;
    const trailsEnabled = trail.enabled;
    const controlDisabled =
      disabled || !trailsEnabled || (layerKey ? !design.stars[layerKey].enabled : false);

    return (
      <SubSection title="Opening">
        <div className={CONTROL_GRID_CLASS}>
          <SliderField
            label="Start particles"
            min={0}
            max={100}
            step={1}
            value={opening.visibility.particlesPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Trail opening start particles value"
            disabled={controlDisabled}
            hint="Percentage of the trail particle budget visible at the centre before the ramp reaches full amount."
            onChange={(value) =>
              setBurstTrailOpeningValue(layerKey, 'visibility', 'particlesPercent', round2(value))
            }
          />
          <SliderField
            label="Ramp time"
            min={STAR_OPENING_PERCENT_MIN}
            max={STAR_OPENING_PERCENT_MAX}
            step={1}
            value={opening.visibility.revealPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Trail opening ramp time value"
            disabled={controlDisabled}
            hint="How much of the star path is used to ramp particles, brightness, and size up to full."
            onChange={(value) =>
              setBurstTrailOpeningValue(layerKey, 'visibility', 'revealPercent', round2(value))
            }
          />
          <SliderField
            label="Start brightness"
            min={0}
            max={TRAIL_OPENING_BRIGHTNESS_MAX}
            step={1}
            value={opening.visibility.brightnessPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Trail opening start brightness value"
            disabled={controlDisabled}
            hint="Brightness at the centre. 100% reaches normal trail brightness immediately."
            onChange={(value) =>
              setBurstTrailOpeningValue(layerKey, 'visibility', 'brightnessPercent', round2(value))
            }
          />
          <SliderField
            label="Start size"
            min={STAR_OPENING_PERCENT_MIN}
            max={STAR_OPENING_PERCENT_MAX}
            step={1}
            value={opening.size.startPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Trail opening start size value"
            disabled={controlDisabled}
            hint="Trail particle size at the centre, as a percentage of normal trail size."
            onChange={(value) =>
              setBurstTrailOpeningValue(layerKey, 'size', 'startPercent', round2(value))
            }
          />
        </div>
      </SubSection>
    );
  }

  function renderBurstTrailClosingControls(layerKey: StarLayerKey | undefined) {
    const trail = currentBurstTrail(layerKey);
    const closing = trail.closing;
    const trailsEnabled = trail.enabled;
    const controlDisabled =
      disabled || !trailsEnabled || (layerKey ? !design.stars[layerKey].enabled : false);
    const sizeEnabled = closing.size.enabled;
    const spreadFadeEnabled = closing.spreadFade.enabled;

    return (
      <SubSection title="Closing">
        <div className={CONTROL_GRID_CLASS}>
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Lifetime model</FieldLabel>
              <InfoTooltip text="Follow star life scales every particle from its parent star's remaining burn. Fixed duration gives every emitted particle its own duration." />
            </div>
            <SelectField
              value={trail.lifetime.mode}
              onChange={(value) => setBurstTrailNested(layerKey, 'lifetime', 'mode', value)}
              options={TRAIL_LIFETIME_MODE_OPTIONS}
              ariaLabel="Trail lifetime model"
              disabled={controlDisabled}
            />
          </Field>
          {trail.lifetime.mode === 'dynamic' ? (
            <SliderField
              label="Star-life share"
              min={0}
              max={TRAIL_PARTICLE_LIFE_MAX}
              step={0.05}
              value={trail.lifetime.percent}
              formatValue={formatMultiplier}
              showNumberInput
              inputAriaLabel="Trail star life share value"
              disabled={controlDisabled}
              hint="Multiplier of the parent star's remaining life. 1x dies with that star; 2x lasts twice as long."
              onChange={(value) =>
                setBurstTrailNested(layerKey, 'lifetime', 'percent', round2(value))
              }
            />
          ) : (
            <SliderField
              label="Fixed life"
              min={0.05}
              max={8}
              step={0.05}
              value={trail.lifetime.baseSeconds}
              formatValue={formatSeconds}
              showNumberInput
              inputAriaLabel="Trail fixed life value"
              disabled={controlDisabled}
              hint="Base lifetime of every newly emitted trail particle."
              onChange={(value) =>
                setBurstTrailNested(layerKey, 'lifetime', 'baseSeconds', round2(value))
              }
            />
          )}
          <SliderField
            label="Life random"
            min={0}
            max={100}
            step={1}
            value={trail.lifetime.variationPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Life random value"
            disabled={controlDisabled}
            hint="Seeded variation in each particle's individual life. Replay stays deterministic."
            onChange={(value) =>
              setBurstTrailNested(layerKey, 'lifetime', 'variationPercent', round2(value))
            }
          />
          <SliderField
            label="Afterglow"
            min={0}
            max={6}
            step={0.05}
            value={trail.lifetime.afterglowSeconds}
            formatValue={formatSeconds}
            showNumberInput
            inputAriaLabel="Trail afterglow value"
            disabled={controlDisabled}
            hint="Extra time added after the selected lifetime model, useful for hanging embers."
            onChange={(value) =>
              setBurstTrailNested(layerKey, 'lifetime', 'afterglowSeconds', round2(value))
            }
          />
          <SwitchField
            label="Size close"
            checked={sizeEnabled}
            disabled={controlDisabled}
            hint="Shrink or hold each trail particle through the final part of its burn."
            onChange={(value) => setBurstTrailClosingValue(layerKey, 'size', 'enabled', value)}
          />
          <SwitchField
            label="Wide tail fade"
            checked={spreadFadeEnabled}
            disabled={controlDisabled}
            hint="Fade the far tail when the tail angle gets very wide."
            onChange={(value) =>
              setBurstTrailClosingValue(layerKey, 'spreadFade', 'enabled', value)
            }
          />
          {sizeEnabled ? (
            <>
              <SliderField
                label="Final size"
                min={STAR_CLOSING_END_PERCENT_MIN}
                max={STAR_CLOSING_END_PERCENT_MAX}
                step={1}
                value={closing.size.endPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Trail closing final size value"
                disabled={controlDisabled}
                hint="Trail particle size at the moment it dies, as a percentage of normal size."
                onChange={(value) =>
                  setBurstTrailClosingValue(layerKey, 'size', 'endPercent', round2(value))
                }
              />
              <SliderField
                label="Shrink time"
                min={STAR_CLOSING_PERCENT_MIN}
                max={STAR_CLOSING_PERCENT_MAX}
                step={1}
                value={closing.size.shrinkPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Trail closing shrink time value"
                disabled={controlDisabled}
                hint="Percentage of the star life used after each trail particle appears to shrink into the final size."
                onChange={(value) =>
                  setBurstTrailClosingValue(layerKey, 'size', 'shrinkPercent', round2(value))
                }
              />
            </>
          ) : null}
          {spreadFadeEnabled ? (
            <>
              <SliderField
                label="Fade angle"
                min={0}
                max={TRAIL_SPREAD_ANGLE_MAX}
                step={1}
                value={closing.spreadFade.startAngle}
                formatValue={formatDegrees}
                showNumberInput
                inputAriaLabel="Wide tail fade angle value"
                disabled={controlDisabled}
                hint="Tail angle where the far tail starts fading."
                onChange={(value) =>
                  setBurstTrailClosingValue(layerKey, 'spreadFade', 'startAngle', round2(value))
                }
              />
              <SliderField
                label="Tail opacity"
                min={0}
                max={100}
                step={1}
                value={closing.spreadFade.endOpacityPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Wide tail opacity value"
                disabled={controlDisabled}
                hint="Opacity of the far tail when the tail angle is at maximum spread."
                onChange={(value) =>
                  setBurstTrailClosingValue(
                    layerKey,
                    'spreadFade',
                    'endOpacityPercent',
                    round2(value),
                  )
                }
              />
            </>
          ) : null}
        </div>
      </SubSection>
    );
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
    const activeLayerPathCount = isBrocade
      ? normaliseStarCount(design.brocade.streakCount ?? design.size)
      : (['outer', 'core'] as const).reduce((total, key) => {
          const layer = design.stars[key];
          return layer.enabled ? total + layer.count : total;
        }, 0);
    const splitPathMultiplier = design.split.enabled ? Math.max(1, design.split.fragments) : 1;
    const budgetedPathCount = Math.max(1, activeLayerPathCount * splitPathMultiplier);
    const budgetedParticlesPerPath = Math.max(
      1,
      Math.floor(BURST_TRAIL_SHELL_PARTICLE_BUDGET / budgetedPathCount),
    );
    const amountHint =
      budgetedParticlesPerPath < BURST_TRAIL_PARTICLES_PER_STAR_MAX
        ? `Requested particles in each star trail. The shell-wide safety budget is shared across up to ${budgetedPathCount} active paths in this design, so values above about ${budgetedParticlesPerPath} may plateau. Geometry-specific emission can lower the effective limit further.`
        : 'Requested particles in each star trail. Dense shells share a shell-wide safety budget, so very high values can plateau as more star paths are enabled.';

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

    function patchBurstTrailStop(index: number, patch: Partial<BurstTrailStop>) {
      patchBurstTrail(layerKey, (trail) => {
        const source =
          trail.stops.length > 0
            ? trail.stops
            : makeBurstTrailPreset(trail.preset === 'custom' ? 'custom' : trail.preset).stops;
        const previousPosition = source[index - 1]?.position ?? 0;
        const nextPosition = source[index + 1]?.position ?? 100;
        const boundedPatch =
          patch.position == null
            ? patch
            : {
                ...patch,
                position: round2(clampNumber(patch.position, previousPosition, nextPosition)),
              };
        return {
          ...trail,
          stops: source.map((stop, stopIndex) =>
            stopIndex === index
              ? { ...stop, ...boundedPatch, shapeWeights: { ...stop.shapeWeights } }
              : { ...stop, shapeWeights: { ...stop.shapeWeights } },
          ),
        };
      });
    }

    return (
      <PanelSection
        title={title}
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
          <div className={CONTROL_GRID_CLASS}>
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

          {isBrocade && !layerKey ? (
            <SubSection title="Brocade trail palette">
              <div className={CONTROL_GRID_CLASS}>
                <ColorField
                  label="Hot trail colour"
                  value={rgbObjectToHex(design.brocade.palette.hot) ?? '#ffedb8'}
                  disabled={controlDisabled}
                  hint="Colour at the fresh, white-hot end of each brocade trail."
                  onChange={(value) => setBrocadeColour('palette', 'hot', value)}
                />
                <ColorField
                  label="Ember trail colour"
                  value={rgbObjectToHex(design.brocade.palette.ember) ?? '#ff6b24'}
                  disabled={controlDisabled}
                  hint="Colour the brocade trail cools towards as it fades."
                  onChange={(value) => setBrocadeColour('palette', 'ember', value)}
                />
              </div>
            </SubSection>
          ) : null}

          <SubSection title="Particles">
            <div className={CONTROL_GRID_CLASS}>
              <SliderField
                label="Amount"
                min={0}
                max={BURST_TRAIL_PARTICLES_PER_STAR_MAX}
                step={1}
                value={burstTrail.particlesPerStar}
                showNumberInput
                inputAriaLabel="Amount value"
                disabled={controlDisabled}
                hint={amountHint}
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
                fullWidth
                hint="Global size for every trail particle before head and tail scaling."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'particleSize', 'base', round2(value))
                }
              />
              <AdvancedControls defaultOpen={false}>
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
                  onChange={(value) =>
                    setBurstTrailNested(layerKey, 'motion', 'spin', round2(value))
                  }
                />
              </AdvancedControls>
            </div>
          </SubSection>

          <SubSection
            title="Trail progression"
            hint="Each stop changes the particle mix along the path. Position 0% is beside the star head; 100% is the oldest tail."
          >
            <div className="space-y-4">
              {editableStops.map((stop, index) => (
                <div
                  key={`${layerKey ?? 'base'}-trail-stop-${index}`}
                  className="rounded-lg border border-[color:var(--color-border-subtle)] p-3"
                >
                  <p className="mb-3 text-xs font-semibold text-[color:var(--color-content-emphasis)]">
                    Stop {index + 1}
                  </p>
                  <div className={CONTROL_GRID_CLASS}>
                    <SliderField
                      label="Position"
                      min={0}
                      max={100}
                      step={1}
                      value={stop.position}
                      formatValue={formatPercent}
                      showNumberInput
                      inputAriaLabel={`Trail stop ${index + 1} position value`}
                      disabled={controlDisabled}
                      hint="Location of this stop from the fresh head to the oldest tail."
                      onChange={(value) => patchBurstTrailStop(index, { position: round2(value) })}
                    />
                    <SliderField
                      label="Density"
                      min={0}
                      max={4}
                      step={0.05}
                      value={stop.density}
                      formatValue={formatMultiplier}
                      showNumberInput
                      inputAriaLabel={`Trail stop ${index + 1} density value`}
                      disabled={controlDisabled}
                      hint="Emission density around this part of the trail. 0 creates a gap."
                      onChange={(value) => patchBurstTrailStop(index, { density: round2(value) })}
                    />
                    <SliderField
                      label="Size"
                      min={0.08}
                      max={TRAIL_PARTICLE_SCALE_MAX}
                      step={0.05}
                      value={stop.size}
                      formatValue={formatMultiplier}
                      showNumberInput
                      // The slider covers the useful multiplier range; typed
                      // values may still use the full schema range (0.08-24).
                      numberInputMax={24}
                      inputAriaLabel={`Trail stop ${index + 1} size value`}
                      disabled={controlDisabled}
                      hint="Particle-size multiplier at this point in the trail."
                      onChange={(value) => patchBurstTrailStop(index, { size: round2(value) })}
                    />
                    <SliderField
                      label="Size variation"
                      min={0}
                      max={100}
                      step={1}
                      value={stop.sizeVariation}
                      formatValue={formatPercent}
                      showNumberInput
                      inputAriaLabel={`Trail stop ${index + 1} size variation value`}
                      disabled={controlDisabled}
                      hint="Seeded particle-size scatter local to this stop."
                      onChange={(value) =>
                        patchBurstTrailStop(index, { sizeVariation: round2(value) })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

          {renderBurstTrailOpeningControls(layerKey)}
          {renderBurstTrailClosingControls(layerKey)}

          <SubSection title="Placement">
            <div className={CONTROL_GRID_CLASS}>
              <SliderField
                label="Head-tail balance"
                min={TRAIL_BIAS_MIN}
                max={TRAIL_BIAS_MAX}
                step={1}
                value={trailBias}
                formatValue={formatTrailBias}
                disabled={controlDisabled}
                fullWidth
                hint="Where the total particle budget lands along each star path. This redistributes placement without changing the amount."
                onChange={(value) => setTrailBias(layerKey, round2(value))}
              />
              <AdvancedControls defaultOpen={false}>
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
                  min={TRAIL_FRONT_SPREAD_ANGLE_MIN}
                  max={TRAIL_FRONT_SPREAD_ANGLE_MAX}
                  step={1}
                  value={burstTrail.width.front}
                  formatValue={formatDegrees}
                  showNumberInput
                  inputAriaLabel="Front angle value"
                  disabled={controlDisabled}
                  hint="Spread angle around the fresh head end of the trail. Higher values scatter particles wider around the current star path."
                  onChange={(value) =>
                    setBurstTrailNested(layerKey, 'width', 'front', round2(value))
                  }
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
                  onChange={(value) =>
                    setBurstTrailNested(layerKey, 'width', 'tail', round2(value))
                  }
                />
                <SliderField
                  label="Width curve"
                  min={0.2}
                  max={4}
                  step={0.05}
                  value={burstTrail.width.curve}
                  formatValue={formatMultiplier}
                  showNumberInput
                  inputAriaLabel="Trail width curve value"
                  disabled={controlDisabled}
                  hint="Shapes the transition from the front angle to the tail angle."
                  onChange={(value) =>
                    setBurstTrailNested(layerKey, 'width', 'curve', round2(value))
                  }
                />
              </AdvancedControls>
            </div>
          </SubSection>

          <SubSection title="Motion">
            <div className={CONTROL_GRID_CLASS}>
              <SliderField
                label="Gravity"
                min={-2}
                max={1}
                step={0.01}
                value={burstTrail.motion.gravity}
                showNumberInput
                inputAriaLabel="Trail gravity value"
                disabled={controlDisabled}
                hint="Vertical acceleration of detached trail particles. More negative falls faster."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'motion', 'gravity', round2(value))
                }
              />
              <SliderField
                label="Drag"
                min={0}
                max={6}
                step={0.05}
                value={burstTrail.motion.drag}
                showNumberInput
                inputAriaLabel="Trail drag value"
                disabled={controlDisabled}
                hint="Air resistance. Higher values stop inherited movement sooner."
                onChange={(value) => setBurstTrailNested(layerKey, 'motion', 'drag', round2(value))}
              />
              <SliderField
                label="Inherited speed"
                min={0}
                max={1}
                step={0.01}
                value={burstTrail.motion.inheritedVelocity}
                formatValue={formatProbability}
                showNumberInput
                inputAriaLabel="Trail inherited speed value"
                disabled={controlDisabled}
                hint="Share of the parent star's velocity retained when a trail particle is released."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'motion', 'inheritedVelocity', round2(value))
                }
              />
              <SliderField
                label="Turbulence"
                min={0}
                max={2}
                step={0.01}
                value={burstTrail.motion.turbulence}
                showNumberInput
                inputAriaLabel="Trail turbulence value"
                disabled={controlDisabled}
                hint="Seeded velocity scatter that roughens a perfectly smooth trail."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'motion', 'turbulence', round2(value))
                }
              />
              <SliderField
                label="Drift X"
                min={-2}
                max={2}
                step={0.01}
                value={burstTrail.motion.driftX}
                showNumberInput
                inputAriaLabel="Trail horizontal drift value"
                disabled={controlDisabled}
                hint="Constant left-right drift applied after emission."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'motion', 'driftX', round2(value))
                }
              />
              <SliderField
                label="Drift Y"
                min={-2}
                max={2}
                step={0.01}
                value={burstTrail.motion.driftY}
                showNumberInput
                inputAriaLabel="Trail vertical drift value"
                disabled={controlDisabled}
                hint="Constant vertical drift added independently of gravity."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'motion', 'driftY', round2(value))
                }
              />
              <SliderField
                label="Drift depth"
                min={-2}
                max={2}
                step={0.01}
                value={burstTrail.motion.driftZ}
                showNumberInput
                inputAriaLabel="Trail depth drift value"
                disabled={controlDisabled}
                hint="Constant front-to-back drift applied after emission."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'motion', 'driftZ', round2(value))
                }
              />
            </div>
          </SubSection>

          <SubSection title="Glow">
            <div className={CONTROL_GRID_CLASS}>
              <SliderField
                label="Brightness"
                min={0}
                max={3}
                step={0.05}
                value={burstTrail.intensity.brightness}
                showNumberInput
                disabled={controlDisabled}
                fullWidth
                hint="How brightly the trail burns. 1 is standard; push higher for a hot, glowing trail."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'intensity', 'brightness', round2(value))
                }
              />
              <AdvancedControls defaultOpen={false}>
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
                <SliderField
                  label="Flicker strength"
                  min={0}
                  max={3}
                  step={0.05}
                  value={burstTrail.flicker.strength}
                  showNumberInput
                  inputAriaLabel="Trail flicker strength value"
                  disabled={controlDisabled}
                  hint="Brightness multiplier for white-hot flicker flashes."
                  onChange={(value) =>
                    setBurstTrailNested(layerKey, 'flicker', 'strength', round2(value))
                  }
                />
                <SliderField
                  label="Flicker life"
                  min={0}
                  max={BURST_TRAIL_FLICKER_LIFE_MAX}
                  step={0.01}
                  value={burstTrail.flicker.lifetimeMultiplier}
                  formatValue={formatMultiplier}
                  showNumberInput
                  inputAriaLabel="Trail flicker life value"
                  disabled={controlDisabled}
                  hint="Lifetime multiplier for a particle selected to flicker."
                  onChange={(value) =>
                    setBurstTrailNested(layerKey, 'flicker', 'lifetimeMultiplier', round2(value))
                  }
                />
              </AdvancedControls>
            </div>
          </SubSection>
        </div>
      </PanelSection>
    );
  }

  function renderStarLayerControls(layerKey: StarLayerKey, title: 'Star' | 'Star Inner') {
    const layer = design.stars[layerKey];
    const usesBrocadeStarPath = isBrocade && layerKey === 'outer';
    const layerEnabled = usesBrocadeStarPath ? headsEnabled : layer.enabled;
    const controlDisabled = usesBrocadeStarPath
      ? disabled || !headsEnabled
      : sectionDisabled[layerKey];
    const toggleId = layerKey === 'outer' ? outerToggleId : coreToggleId;
    const isInnerLayer = layerKey === 'core';
    const burst = usesBrocadeStarPath ? design.burst : layer.burst;
    const starCount = usesBrocadeStarPath
      ? (design.brocade.streakCount ?? design.size)
      : layer.count;
    const starSize = usesBrocadeStarPath ? design.brocade.headSize : layer.head.size;
    const glowStrength = usesBrocadeStarPath
      ? design.brocade.glowStrength
      : layer.head.glowStrength;

    return (
      <PanelSection
        title={title}
        inactive={!layerEnabled}
        titleAccessory={
          <InfoTooltip text={`${title} has its own burst, head, colour, and trail settings.`} />
        }
        action={
          <Switch
            id={toggleId}
            aria-label={title}
            checked={layerEnabled}
            onCheckedChange={(value) => setStarLayerEnabled(layerKey, value)}
            disabled={disabled}
          />
        }
      >
        <div className="space-y-5">
          <div className={CONTROL_GRID_CLASS}>
            {!usesBrocadeStarPath ? (
              <SwitchField
                label="Head dot"
                checked={layer.head.visible}
                disabled={controlDisabled}
                hint="Render the luminous star head. Turn this off for a trail-only effect while keeping its trajectory alive."
                onChange={(value) => setStarHeadVisible(layerKey, value)}
              />
            ) : null}
            {showStarCount ? (
              <SliderField
                label="Star count"
                min={STAR_COUNT_MIN}
                max={STAR_COUNT_MAX}
                step={1}
                value={normaliseStarCount(starCount)}
                disabled={controlDisabled}
                hint={
                  isInnerLayer
                    ? 'How many inner stars this layer breaks into. It starts smaller, but can be made fuller than Star.'
                    : 'How many stars this layer breaks into. Fuller shells are capped at 100 for a clean preview.'
                }
                onChange={(value) => setStarCount(layerKey, value)}
              />
            ) : null}
            <SliderField
              label="Burst size"
              min={STAR_SPEED_MIN}
              max={STAR_SPEED_MAX}
              step={0.1}
              value={round2(rangeMid(burst.speed))}
              disabled={controlDisabled}
              hint={
                isInnerLayer
                  ? 'How far Star Inner flies from the centre. It can sit inside Star or push past it.'
                  : 'How far Star flies from the centre.'
              }
              onChange={(value) =>
                setStarBurstRangeMid(layerKey, 'speed', value, rangeHalfWidth(burst.speed))
              }
            />
            <SliderField
              label="Burst variation"
              min={0}
              max={Math.min(
                rangeMid(burst.speed) - STAR_SPEED_MIN,
                STAR_SPEED_MAX - rangeMid(burst.speed),
              )}
              step={0.05}
              value={round2(rangeHalfWidth(burst.speed))}
              showNumberInput
              inputAriaLabel={`${title} burst variation value`}
              disabled={controlDisabled}
              hint="Seeded speed spread around Burst size. 0 gives every star the same radial speed."
              onChange={(value) => setStarSpeedSpread(layerKey, round2(value))}
            />
            <SliderField
              label="Hang time"
              min={STAR_LIFE_MIN}
              max={STAR_LIFE_MAX}
              step={0.05}
              value={round2(rangeMid(burst.life))}
              formatValue={formatSeconds}
              disabled={controlDisabled}
              hint="How long this layer's stars burn before fading."
              onChange={(value) => setStarBurstLifeMid(layerKey, value)}
            />
            <SliderField
              label="Floatiness"
              min={STAR_GRAVITY_MIN}
              max={STAR_GRAVITY_MAX}
              step={0.01}
              value={round2(rangeUpper(burst.gravity))}
              disabled={controlDisabled}
              hint="Upper gravity bound. 0 floats; negative values sink; positive values continue rising."
              onChange={(value) => setStarGravityUpper(layerKey, value)}
            />
            <SliderField
              label="Gravity variation"
              min={0}
              max={Math.max(0, rangeUpper(burst.gravity) - STAR_GRAVITY_MIN)}
              step={0.01}
              value={round2(Math.abs(burst.gravity[1] - burst.gravity[0]))}
              showNumberInput
              inputAriaLabel={`${title} gravity variation value`}
              disabled={controlDisabled}
              hint="Seeded spread below the Floatiness value. Higher produces a mix of hanging and fast-falling stars."
              onChange={(value) => setStarGravitySpread(layerKey, round2(value))}
            />
            <SliderField
              label="Air resistance"
              min={0}
              max={STAR_AIR_RESISTANCE_PERCENT_MAX}
              step={1}
              value={burst.airResistancePercent}
              formatValue={formatPercent}
              showNumberInput
              inputAriaLabel={`${title} air resistance value`}
              disabled={controlDisabled}
              hint="Damping applied after this geometry's own drag tuning. 100% preserves its calibrated motion; 0% removes damping."
              onChange={(value) => setStarBurstScalar(layerKey, 'airResistancePercent', value)}
            />
            <SliderField
              label="Terminal fall speed"
              min={0}
              max={STAR_TERMINAL_VELOCITY_MAX}
              step={0.1}
              value={burst.terminalVelocity}
              showNumberInput
              inputAriaLabel={`${title} terminal fall speed value`}
              disabled={controlDisabled}
              hint="Maximum downward speed for this layer. 18 preserves the existing renderer cap; 0 almost arrests descent."
              onChange={(value) => setStarBurstScalar(layerKey, 'terminalVelocity', value)}
            />
            <SliderField
              label="Star size"
              min={usesBrocadeStarPath ? BROCADE_HEAD_SIZE_MIN : STAR_SIZE_MIN}
              max={usesBrocadeStarPath ? BROCADE_HEAD_SIZE_MAX : STAR_SIZE_MAX}
              step={usesBrocadeStarPath ? BROCADE_HEAD_SIZE_STEP : STAR_SIZE_STEP}
              value={starSize}
              disabled={controlDisabled}
              hint="Size budget for each glowing star in this layer."
              onChange={(value) => setStarHeadSize(layerKey, value)}
            />
            <CalibratedSliderField
              label="Glow strength"
              range={headGlowStrengthRange}
              value={glowStrength}
              disabled={controlDisabled}
              hint="Halo brightness around each star in this layer."
              onChange={(value) => setStarGlowStrength(layerKey, value)}
            />
          </div>

          {isInnerLayer ? renderStarColourPatternControls(layerKey, controlDisabled) : null}

          {renderStarAppearance(
            layerKey,
            controlDisabled,
            layerKey === 'outer' ? starControls : undefined,
          )}

          {controlScope === 'star' ? null : renderBurstTrailControls(layerKey)}
        </div>
      </PanelSection>
    );
  }

  if (controlScope === 'trail') {
    return <>{renderBurstTrailControls()}</>;
  }

  if (controlScope === 'star') {
    return <>{renderStarLayerControls('outer', 'Star')}</>;
  }

  if (controlScope === 'starInner') {
    return <>{renderStarLayerControls('core', 'Star Inner')}</>;
  }

  if (controlScope === 'launchShell') {
    return (
      <div className="space-y-5">
        {renderLiftVelocityControl(
          'Launch speed, which sets the burst height. Small keeps effects low; High throws them taller.',
        )}
        {renderLaunchShellParticleControls()}
      </div>
    );
  }

  if (controlScope === 'launchTrail') {
    return (
      <div className="space-y-5">
        {renderLaunchShellTrailControls()}
        {renderLiftParticleControls()}
      </div>
    );
  }

  function renderLaunchControls(includeLiftParticles = false) {
    const launchContent = (
      <div className="space-y-5">
        {renderLiftVelocityControl(
          'Launch speed, which sets the burst height. Small keeps effects low; High throws them taller.',
        )}
        {renderLaunchShellParticleControls()}
        {renderLaunchShellTrailControls()}
      </div>
    );

    if (controlScope === 'launch') {
      return (
        <div className="space-y-5">
          {launchContent}
          {includeLiftParticles ? renderLiftParticleControls() : null}
        </div>
      );
    }

    return (
      <>
        <PanelSection title="Launch">{launchContent}</PanelSection>

        {includeLiftParticles ? renderLiftParticleControls() : null}
      </>
    );
  }

  function renderSoundControls() {
    const soundContent = (
      <div className={CONTROL_GRID_CLASS}>
        {renderLaunchSoundControl()}
        {isGroundEmitter ? null : renderBoomControl()}
      </div>
    );

    if (controlScope === 'sound') {
      return soundContent;
    }

    return <PanelSection title="Sound">{soundContent}</PanelSection>;
  }

  function setGeometryTuningValue(group: GeometryTuningGroupKey, key: string, value: unknown) {
    mutate((draft) => {
      const tuning = ensureRecord(draft, 'geometryTuning');
      const target = ensureRecord(tuning, group);
      target[key] = value;
    });
  }

  function renderGeometryControls() {
    // Brocade crowns burst through their own calibrated path, tuned by the
    // dedicated brocade panel rather than the shared geometry tuning.
    const group = GEOMETRY_TUNING_GROUPS[design.geometry];
    const content = (
      <div className="space-y-5">
        <div className={CONTROL_GRID_CLASS}>
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Geometry</FieldLabel>
              <InfoTooltip text="The main trajectory layout. Ground emitters such as fountains and roman candles skip the shell-lift phase." />
            </div>
            <SelectField
              value={design.geometry}
              onChange={(value) => setRenderValue('geometry', value)}
              options={GEOMETRY_OPTIONS}
              ariaLabel="Firework geometry"
              disabled={disabled}
            />
          </Field>
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Star distribution</FieldLabel>
              <InfoTooltip text="Seeded distribution used inside the selected geometry. Strobe phase varies colour selection; configure actual blinking in the Strobe tab." />
            </div>
            <SelectField
              value={design.pattern}
              onChange={(value) => setRenderValue('pattern', value)}
              options={PATTERN_OPTIONS}
              ariaLabel="Star distribution pattern"
              disabled={disabled}
            />
          </Field>
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Legacy effect profile</FieldLabel>
              <InfoTooltip text="Compatibility profile used by imported effects and a few renderer presets. Geometry controls motion; the Trail and Effects tabs control the visible treatment." />
            </div>
            <SelectField
              value={design.trailProfile}
              onChange={(value) => setRenderValue('trailProfile', value)}
              options={TRAIL_PROFILE_OPTIONS}
              ariaLabel="Legacy effect profile"
              disabled={disabled}
            />
          </Field>
        </div>
        {group && !isBrocade ? (
          <SubSection title="Shape tuning">
            <div className={CONTROL_GRID_CLASS}>
              {GEOMETRY_TUNING_SLIDERS[group].map((slider) => {
                const values = design.geometryTuning[group] as Record<string, number>;
                return (
                  <SliderField
                    key={slider.key}
                    label={slider.label}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={round2(values[slider.key] ?? slider.min)}
                    disabled={disabled}
                    hint={slider.hint}
                    onChange={(value) => setGeometryTuningValue(group, slider.key, round2(value))}
                  />
                );
              })}
            </div>
          </SubSection>
        ) : (
          <p className="text-muted-foreground text-xs leading-5">
            This geometry uses the renderer's calibrated shape and has no additional tuning.
          </p>
        )}
      </div>
    );

    if (controlScope === 'geometry') return content;

    return (
      <PanelSection
        title="Geometry"
        titleAccessory={
          <InfoTooltip text="Shape tuning for this burst geometry. These values save with the effect JSON and were previously fixed inside the renderer." />
        }
      >
        {content}
      </PanelSection>
    );
  }

  function renderStrobeControls() {
    return (
      <PanelSection
        title="Strobe"
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
        <div className={CONTROL_GRID_CLASS}>
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
          <SliderField
            label="Strobe amount"
            min={0}
            max={100}
            step={1}
            value={design.strobe.amountPercent}
            disabled={sectionDisabled.strobe}
            hint="Percentage of stars that strobe; the rest burn steadily."
            onChange={(value) => setNestedRenderValue('strobe', 'amountPercent', value)}
          />
          <SliderField
            label="Dark size"
            min={0}
            max={60}
            step={0.5}
            value={design.strobe.dimPercent}
            disabled={sectionDisabled.strobe}
            hint="Star size during the dark phase, as a percentage of the lit size. 0 fully vanishes."
            onChange={(value) => setNestedRenderValue('strobe', 'dimPercent', round2(value))}
          />
          <SliderField
            label="Desync"
            min={0}
            max={1}
            step={0.001}
            value={design.strobe.desync}
            disabled={sectionDisabled.strobe}
            hint="Per-star phase offset. 0 blinks every star in unison; higher scatters the blinks."
            onChange={(value) => setNestedRenderValue('strobe', 'desync', value)}
          />
        </div>
      </PanelSection>
    );
  }

  function renderCrackleControls() {
    return (
      <PanelSection
        title="Crackle"
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
        <div className={CONTROL_GRID_CLASS}>
          <SliderField
            label="Ignition chance"
            min={0}
            max={1}
            step={0.01}
            value={design.crackle.probability}
            formatValue={formatProbability}
            showNumberInput
            inputAriaLabel="Crackle ignition chance value"
            disabled={sectionDisabled.crackle}
            hint="Time-normalised chance that an eligible dying star ignites its crackle."
            onChange={(value) => setNestedRenderValue('crackle', 'probability', round2(value))}
          />
          <SliderField
            label="Trigger window"
            min={0.1}
            max={4}
            step={0.05}
            value={design.crackle.triggerWindowSeconds}
            formatValue={formatSeconds}
            showNumberInput
            inputAriaLabel="Crackle trigger window value"
            disabled={sectionDisabled.crackle}
            hint="How early before star death the crackle may ignite."
            onChange={(value) =>
              setNestedRenderValue('crackle', 'triggerWindowSeconds', round2(value))
            }
          />
          <SliderField
            label="Fragment count"
            min={1}
            max={200}
            step={1}
            value={design.crackle.fragmentCount}
            showNumberInput
            inputAriaLabel="Crackle fragment count value"
            disabled={sectionDisabled.crackle}
            hint="Base number of hot fragments released by each crackle event."
            onChange={(value) =>
              setNestedRenderValue('crackle', 'fragmentCount', Math.round(value))
            }
          />
          <SliderField
            label="Count variation"
            min={0}
            max={100}
            step={1}
            value={design.crackle.fragmentCountVariationPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Crackle fragment count variation value"
            disabled={sectionDisabled.crackle}
            hint="Seeded variation in fragment count between crackle events."
            onChange={(value) =>
              setNestedRenderValue('crackle', 'fragmentCountVariationPercent', round2(value))
            }
          />
          <SliderField
            label="Fragment size"
            min={1}
            max={120}
            step={1}
            value={design.crackle.fragmentSize}
            showNumberInput
            inputAriaLabel="Crackle fragment size value"
            disabled={sectionDisabled.crackle}
            hint="Base luminous size of each crackle fragment."
            onChange={(value) => setNestedRenderValue('crackle', 'fragmentSize', round2(value))}
          />
          <SliderField
            label="Size variation"
            min={0}
            max={100}
            step={1}
            value={design.crackle.fragmentSizeVariationPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Crackle fragment size variation value"
            disabled={sectionDisabled.crackle}
            hint="Seeded size variation within each crackle cloud."
            onChange={(value) =>
              setNestedRenderValue('crackle', 'fragmentSizeVariationPercent', round2(value))
            }
          />
          <SliderField
            label="Fragment speed"
            min={0}
            max={6}
            step={0.05}
            value={design.crackle.fragmentSpeed}
            showNumberInput
            inputAriaLabel="Crackle fragment speed value"
            disabled={sectionDisabled.crackle}
            hint="Base force pushing fragments away from the parent star."
            onChange={(value) => setNestedRenderValue('crackle', 'fragmentSpeed', round2(value))}
          />
          <SliderField
            label="Speed variation"
            min={0}
            max={100}
            step={1}
            value={design.crackle.fragmentSpeedVariationPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Crackle fragment speed variation value"
            disabled={sectionDisabled.crackle}
            hint="Seeded speed variation that breaks up a uniform spherical pop."
            onChange={(value) =>
              setNestedRenderValue('crackle', 'fragmentSpeedVariationPercent', round2(value))
            }
          />
          <SliderField
            label="Fragment life"
            min={0.05}
            max={4}
            step={0.05}
            value={design.crackle.fragmentLifeSeconds}
            formatValue={formatSeconds}
            showNumberInput
            inputAriaLabel="Crackle fragment life value"
            disabled={sectionDisabled.crackle}
            hint="Base burn time of each crackle fragment."
            onChange={(value) =>
              setNestedRenderValue('crackle', 'fragmentLifeSeconds', round2(value))
            }
          />
          <SliderField
            label="Life variation"
            min={0}
            max={100}
            step={1}
            value={design.crackle.fragmentLifeVariationPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Crackle fragment life variation value"
            disabled={sectionDisabled.crackle}
            hint="Seeded burn-time variation across the fragment cloud."
            onChange={(value) =>
              setNestedRenderValue('crackle', 'fragmentLifeVariationPercent', round2(value))
            }
          />
          <SliderField
            label="Fragment gravity"
            min={-2}
            max={1}
            step={0.01}
            value={design.crackle.fragmentGravity}
            showNumberInput
            inputAriaLabel="Crackle fragment gravity value"
            disabled={sectionDisabled.crackle}
            hint="Gravity applied to fragments independently of the parent star."
            onChange={(value) => setNestedRenderValue('crackle', 'fragmentGravity', round2(value))}
          />
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Fragment colour</FieldLabel>
              <InfoTooltip text="Use metallic silver or gold, or inherit each parent star's colour." />
            </div>
            <SelectField
              value={design.crackle.colourMode}
              onChange={(value) => setNestedRenderValue('crackle', 'colourMode', value)}
              options={CRACKLE_COLOUR_OPTIONS}
              ariaLabel="Crackle fragment colour"
              disabled={sectionDisabled.crackle}
            />
          </Field>
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Crackle sound</FieldLabel>
              <InfoTooltip text="Sound event eligible to play when a crackle cloud ignites." />
            </div>
            <SelectField
              value={design.crackle.sound}
              onChange={(value) => setNestedRenderValue('crackle', 'sound', value)}
              options={CRACKLE_SOUND_OPTIONS}
              ariaLabel="Crackle sound"
              disabled={sectionDisabled.crackle}
            />
          </Field>
          <SliderField
            label="Sound chance"
            min={0}
            max={1}
            step={0.01}
            value={design.crackle.soundChance}
            formatValue={formatProbability}
            showNumberInput
            inputAriaLabel="Crackle sound chance value"
            disabled={sectionDisabled.crackle}
            hint="Chance that an audible crackle event plays its selected sound."
            onChange={(value) => setNestedRenderValue('crackle', 'soundChance', round2(value))}
          />
          <SliderField
            label="Sound volume"
            min={0}
            max={1}
            step={0.01}
            value={design.crackle.soundVolume}
            formatValue={formatProbability}
            showNumberInput
            inputAriaLabel="Crackle sound volume value"
            disabled={sectionDisabled.crackle}
            hint="Volume multiplier for the selected crackle sound."
            onChange={(value) => setNestedRenderValue('crackle', 'soundVolume', round2(value))}
          />
        </div>
      </PanelSection>
    );
  }

  function renderSplitControls() {
    if (!showSplitControls && controlScope !== 'split') return null;

    return (
      <PanelSection
        title="Split"
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
        {design.split.enabled ? (
          <div className={CONTROL_GRID_CLASS}>
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
            <SliderField
              label="Split timing"
              min={0.15}
              max={0.85}
              step={0.01}
              value={design.split.delayRatio}
              formatValue={formatProbability}
              showNumberInput
              inputAriaLabel="Split timing value"
              disabled={sectionDisabled.split}
              hint="Point in the parent star's life when it divides. Lower splits earlier; higher splits near the end."
              onChange={(value) => setNestedRenderValue('split', 'delayRatio', round2(value))}
            />
            <SliderField
              label="Fragment life"
              min={0.1}
              max={6}
              step={0.05}
              value={design.split.lifeBaseSeconds}
              disabled={sectionDisabled.split}
              hint="Minimum fragment burn time in seconds."
              onChange={(value) => setNestedRenderValue('split', 'lifeBaseSeconds', round2(value))}
            />
            <SliderField
              label="Fragment life spread"
              min={0}
              max={6}
              step={0.05}
              value={design.split.lifeVariationSeconds}
              disabled={sectionDisabled.split}
              hint="Random extra burn time on top of the base, in seconds."
              onChange={(value) =>
                setNestedRenderValue('split', 'lifeVariationSeconds', round2(value))
              }
            />
            <SliderField
              label="Fragment size"
              min={5}
              max={200}
              step={1}
              value={design.split.headSizePercent}
              disabled={sectionDisabled.split}
              hint="Fragment head size as a percentage of the parent star."
              onChange={(value) => setNestedRenderValue('split', 'headSizePercent', value)}
            />
            <SliderField
              label="Fragment trail life"
              min={5}
              max={300}
              step={1}
              value={design.split.trailLifePercent}
              disabled={sectionDisabled.split}
              hint="Fragment trail persistence relative to the parent trail."
              onChange={(value) => setNestedRenderValue('split', 'trailLifePercent', value)}
            />
          </div>
        ) : null}
      </PanelSection>
    );
  }

  if (controlScope === 'launch') return <>{renderLaunchControls(true)}</>;
  if (controlScope === 'geometry') return <>{renderGeometryControls()}</>;
  if (controlScope === 'smoke') return <>{renderSmokeControls()}</>;
  if (controlScope === 'strobe') return <>{renderStrobeControls()}</>;
  if (controlScope === 'crackle') return <>{renderCrackleControls()}</>;
  if (controlScope === 'split') return <>{renderSplitControls()}</>;
  if (controlScope === 'sound') return <>{renderSoundControls()}</>;

  if (isBrocade) {
    return (
      <>
        <PanelSection title="Burst">
          <div className="space-y-5">
            <div className={CONTROL_GRID_CLASS}>
              {showStarCount ? (
                <SliderField
                  label="Streak count"
                  min={STAR_COUNT_MIN}
                  max={STAR_COUNT_MAX}
                  step={1}
                  value={normaliseStarCount(design.brocade.streakCount ?? design.size)}
                  disabled={disabled}
                  hint="How many streaks the shell splits into. 20 reads as a small cake; 60 is a full display crown."
                  onChange={setStreakCount}
                />
              ) : null}
              <SliderField
                label="Burst size"
                min={STAR_SPEED_MIN}
                max={STAR_SPEED_MAX}
                step={0.1}
                value={round2(rangeMid(design.burst.speed))}
                disabled={disabled}
                hint="How far the streaks fly from the centre. 2.5 is garden-size, 4.8 is a wide display sphere, 8+ is an extra-wide crown."
                onChange={(value) => setBurstRangeMid('speed', value, BROCADE_SPEED_HALF_WIDTH)}
              />
              <SliderField
                label="Hang time"
                min={STAR_LIFE_MIN}
                max={STAR_LIFE_MAX}
                step={0.05}
                value={round2(rangeMid(design.burst.life))}
                formatValue={formatSeconds}
                disabled={disabled}
                hint="How long the streak heads burn before fading. Trails always melt away just before their head does."
                onChange={(value) => setBurstRangeMid('life', value, BROCADE_LIFE_HALF_WIDTH)}
              />
              <SliderField
                label="Floatiness"
                min={STAR_GRAVITY_MIN}
                max={STAR_GRAVITY_MAX}
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
              {showLaunch ? renderLaunchSoundControl() : null}
              {showLaunch ? renderBoomControl() : null}
            </div>
            {showLaunch ? renderLaunchShellParticleControls() : null}
            {showLaunch ? renderLaunchShellTrailControls() : null}
          </div>
        </PanelSection>

        {afterBurst}

        {renderLiftParticleControls()}

        {renderSmokeControls()}

        {renderBurstTrailControls()}

        <PanelSection
          title="Heads"
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
            <div className={CONTROL_GRID_CLASS}>
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
            <SubSection title="Head palette">
              <div className={CONTROL_GRID_CLASS}>
                <ColorField
                  label="Green head colour"
                  value={rgbObjectToHex(design.brocade.headColors.green) ?? '#66ff80'}
                  disabled={sectionDisabled.heads}
                  hint="Colour used by brocade heads assigned to the green side of the mix."
                  onChange={(value) => setBrocadeColour('headColors', 'green', value)}
                />
                <ColorField
                  label="Red head colour"
                  value={rgbObjectToHex(design.brocade.headColors.red) ?? '#ff4752'}
                  disabled={sectionDisabled.heads}
                  hint="Colour used by brocade heads assigned to the red side of the mix."
                  onChange={(value) => setBrocadeColour('headColors', 'red', value)}
                />
                <SliderField
                  label="Green share"
                  min={0}
                  max={100}
                  step={1}
                  value={round2(design.brocade.greenRatio * 100)}
                  formatValue={formatPercent}
                  showNumberInput
                  inputAriaLabel="Brocade green head share"
                  disabled={sectionDisabled.heads}
                  hint="Percentage of brocade heads assigned the green colour. The remainder use red."
                  onChange={(value) =>
                    setBrocadeValue('greenRatio', round2(clampNumber(value, 0, 100) / 100))
                  }
                />
              </div>
            </SubSection>
            {renderStarAppearance('outer', sectionDisabled.heads, undefined, false)}
          </div>
        </PanelSection>
      </>
    );
  }

  return (
    <>
      {showLaunch ? renderLaunchControls() : null}

      {afterBurst}

      {renderLiftParticleControls()}

      {renderSmokeControls()}

      {renderStarLayerControls('outer', 'Star')}

      {renderStarLayerControls('core', 'Star Inner')}

      {renderGeometryControls()}

      {showLaunch ? renderSoundControls() : null}

      {renderStrobeControls()}

      {renderCrackleControls()}

      {renderSplitControls()}
    </>
  );
}
