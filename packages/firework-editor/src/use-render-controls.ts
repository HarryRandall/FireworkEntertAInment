'use client';
import { isGroundGeometry } from '@showcrafter/fireworks/behaviours';
import type {
  BurstTrailPreset,
  FireworkDesign,
  GeometryTuningGroupKey,
  StarLayerKey,
} from '@showcrafter/fireworks/design';
import {
  makeBurstTrailPreset,
  STAR_AIR_RESISTANCE_PERCENT_MAX,
  STAR_TERMINAL_VELOCITY_MAX,
} from '@showcrafter/fireworks/design';
import { useId, useState } from 'react';
import type {
  BurstTrail,
  BurstTrailClosing,
  BurstTrailOpening,
  LiftVelocityMode,
  StarColourPatternEntry,
  StarHeadClosing,
  StarHeadOpening,
} from './control-values.ts';
import {
  BACKGROUND_GLOW_OPACITY_RANGE,
  BACKGROUND_GLOW_SIZE_RANGE,
  BACKGROUND_GLOW_SOFTNESS_RANGE,
  BACKGROUND_GLOW_STRENGTH_RANGE,
  BOOM_OPTIONS,
  boundedRangeFromMidpoint,
  clampNumber,
  cloneTrail,
  CORE_BRIGHTNESS_RANGE,
  CORE_OPACITY_RANGE,
  CORE_SOFTNESS_RANGE,
  ensureRecord,
  frontClumpFromTrailBias,
  GLOW_OPACITY_RANGE,
  GLOW_SIZE_RANGE,
  GLOW_SOFTNESS_RANGE,
  HEAD_GLOW_STRENGTH_RANGE,
  hexToRgbObject,
  lifeRangeFromMidAndHalfWidth,
  LIFT_VELOCITY_OPTIONS,
  rangeHalfWidth,
  rangeMid,
  rangeUpper,
  readRecord,
  round2,
  STAR_COLOUR_PATTERN_MAX_COLOURS,
  STAR_COUNT_MAX,
  STAR_COUNT_MIN,
  STAR_GRAVITY_MAX,
  STAR_GRAVITY_MIN,
  STAR_SPEED_MAX,
  STAR_SPEED_MIN,
  WHITE_CORE_BLUR_RANGE,
  WHITE_CORE_SIZE_RANGE,
} from './control-values.ts';
import type { JsonRecord, RenderControlsProps } from './types.ts';
export function useRenderControls({
  design,
  defaults,
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
  const headGlowStrengthRange = HEAD_GLOW_STRENGTH_RANGE;
  const coreSoftnessRange = CORE_SOFTNESS_RANGE;
  const coreBrightnessRange = CORE_BRIGHTNESS_RANGE;
  const whiteCoreSizeRange = WHITE_CORE_SIZE_RANGE;
  const whiteCoreBlurRange = WHITE_CORE_BLUR_RANGE;
  const coreOpacityRange = CORE_OPACITY_RANGE;
  const glowSizeRange = GLOW_SIZE_RANGE;
  const glowSoftnessRange = GLOW_SOFTNESS_RANGE;
  const glowOpacityRange = GLOW_OPACITY_RANGE;
  const backgroundGlowSizeRange = BACKGROUND_GLOW_SIZE_RANGE;
  const backgroundGlowStrengthRange = BACKGROUND_GLOW_STRENGTH_RANGE;
  const backgroundGlowSoftnessRange = BACKGROUND_GLOW_SOFTNESS_RANGE;
  const backgroundGlowOpacityRange = BACKGROUND_GLOW_OPACITY_RANGE;
  const isGroundEmitter = isGroundGeometry(design.geometry);
  const headsEnabled = design.stars.outer.head.visible;
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
    });
  }
  function setStarLayerEnabled(layerKey: StarLayerKey, value: boolean) {
    mutate((draft) => {
      ensureDraftStarLayer(draft, layerKey).enabled = value;
    });
  }
  function setStarCount(layerKey: StarLayerKey, value: number) {
    const count = normaliseStarCount(value);
    mutate((draft) => {
      ensureDraftStarLayer(draft, layerKey).count = count;
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
    setLayerBurstRangeMid(layerKey, key, mid, halfWidth);
  }
  function setStarBurstLifeMid(layerKey: StarLayerKey, mid: number) {
    setLayerBurstLifeMid(layerKey, mid);
  }
  function setStarGravityUpper(layerKey: StarLayerKey, maxGravity: number) {
    setLayerGravityUpper(layerKey, maxGravity);
  }
  function setStarSpeedSpread(layerKey: StarLayerKey, halfWidth: number) {
    const burst = design.stars[layerKey].burst;
    setStarBurstRangeMid(layerKey, 'speed', rangeMid(burst.speed), halfWidth);
  }
  function setStarGravitySpread(layerKey: StarLayerKey, spread: number) {
    const burst = design.stars[layerKey].burst;
    const upper = rangeUpper(burst.gravity);
    const next: [number, number] = [
      round2(Math.max(STAR_GRAVITY_MIN, upper - spread)),
      round2(upper),
    ];
    mutate((draft) => {
      const target = ensureDraftStarNested(draft, layerKey, 'burst');
      target.gravity = next;
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
    });
  }
  function setStarHeadSize(layerKey: StarLayerKey, value: number) {
    mutate((draft) => {
      ensureDraftStarNested(draft, layerKey, 'head').size = value;
    });
  }
  function setStarHeadVisible(layerKey: StarLayerKey, value: boolean) {
    mutate((draft) => {
      ensureDraftStarNested(draft, layerKey, 'head').visible = value;
    });
  }
  function setStarGlowStrength(layerKey: StarLayerKey, value: number) {
    const strength = round2(value);
    mutate((draft) => {
      ensureDraftStarNested(draft, layerKey, 'head').glowStrength = strength;
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
  function currentBurstTrail(layerKey?: StarLayerKey): BurstTrail {
    return layerKey ? design.stars[layerKey].burstTrail : design.burstTrail;
  }
  function writeBurstTrail(layerKey: StarLayerKey | undefined, next: BurstTrail) {
    mutate((draft) => {
      const stars = ensureRecord(draft, 'stars');
      const layer = ensureRecord(stars, layerKey ?? 'outer');
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
  function setGeometryTuningValue(group: GeometryTuningGroupKey, key: string, value: unknown) {
    mutate((draft) => {
      const tuning = ensureRecord(draft, 'geometryTuning');
      const target = ensureRecord(tuning, group);
      target[key] = value;
    });
  }
  return {
    design,
    defaults,
    mutate,
    disabled,
    afterBurst,
    starControls,
    showLaunch,
    showStarCount,
    controlScope,
    outerTrailsToggleId,
    coreTrailsToggleId,
    headsToggleId,
    outerToggleId,
    coreToggleId,
    liftParticlesToggleId,
    smokeToggleId,
    strobeToggleId,
    crackleToggleId,
    splitToggleId,
    forceCustomLiftVelocity,
    setForceCustomLiftVelocity,
    strobeDefaults,
    crackleDefaults,
    soundDefaults,
    mortarDefaults,
    headGlowStrengthRange,
    coreSoftnessRange,
    coreBrightnessRange,
    whiteCoreSizeRange,
    whiteCoreBlurRange,
    coreOpacityRange,
    glowSizeRange,
    glowSoftnessRange,
    glowOpacityRange,
    backgroundGlowSizeRange,
    backgroundGlowStrengthRange,
    backgroundGlowSoftnessRange,
    backgroundGlowOpacityRange,
    isGroundEmitter,
    headsEnabled,
    outerEnabled,
    coreEnabled,
    strobeEnabled,
    crackleEnabled,
    liftParticlesEnabled,
    smokeEnabled,
    showSplitControls,
    boomValue,
    launchSoundValue,
    liftVelocity,
    sectionDisabled,
    setRenderValue,
    setLiftVelocityMode,
    setNestedRenderValue,
    setLaunchSoundValue,
    setLaunchValue,
    setLaunchNestedValue,
    ensureDraftStarLayer,
    ensureDraftStarNested,
    normaliseStarCount,
    setBurstRangeMid,
    setStarLayerEnabled,
    setStarCount,
    setLayerNestedValue,
    setStarLayerColour,
    setStarColourPatternValue,
    setStarColourPatternEntries,
    updateStarColourPatternEntry,
    addStarColourPatternEntry,
    removeStarColourPatternEntry,
    setStarBurstRangeMid,
    setStarBurstLifeMid,
    setStarGravityUpper,
    setStarSpeedSpread,
    setStarGravitySpread,
    setStarBurstScalar,
    setStarHeadSize,
    setStarHeadVisible,
    setStarGlowStrength,
    setLayerHeadOpeningValue,
    setLayerHeadClosingValue,
    setLayerBurstLifeMid,
    setLayerBurstLifeHalfWidth,
    setLayerBurstRangeMid,
    setLayerGravityUpper,
    currentBurstTrail,
    writeBurstTrail,
    setBurstTrailPreset,
    patchBurstTrail,
    setBurstTrailEnabled,
    setBurstTrailValue,
    setBurstTrailNested,
    setBurstTrailOpeningValue,
    setBurstTrailClosingValue,
    setTrailBias,
    setGeometryTuningValue,
  };
}
export type RendererControlsContext = ReturnType<typeof useRenderControls>;
