'use client';
import {
  AppearanceField,
  SwitchField,
} from '@/ui/firework-editor/firework-render-controls/ControlFields';
import {
  CONTROL_GRID_CLASS,
  PanelSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Switch } from '@/ui/primitives/switch';
import {
  formatPercent,
  formatSeconds,
  rangeHalfWidth,
  rangeMid,
  rangeUpper,
  round2,
  STAR_COUNT_MAX,
  STAR_COUNT_MIN,
  STAR_GRAVITY_MAX,
  STAR_GRAVITY_MIN,
  STAR_LIFE_MAX,
  STAR_LIFE_MIN,
  STAR_SIZE_MAX,
  STAR_SIZE_MIN,
  STAR_SIZE_STEP,
  STAR_SPEED_MAX,
  STAR_SPEED_MIN,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import {
  STAR_AIR_RESISTANCE_PERCENT_MAX,
  STAR_TERMINAL_VELOCITY_MAX,
} from '@showcrafter/fireworks/design';
import { RendererField as SliderField } from '../RendererField';
import { renderBurstTrailControls } from './renderBurstTrailControls';
import { renderStarAppearance } from './renderStarAppearance';
import { renderStarColourPatternControls } from './renderStarColourPatternControls';

export function renderStarLayerControls(
  context: RendererControlsContext,
  layerKey: StarLayerKey,
  title: 'Star' | 'Star Inner',
) {
  const {
    design,
    disabled,
    sectionDisabled,
    outerToggleId,
    coreToggleId,
    setStarLayerEnabled,
    setStarHeadVisible,
    showStarCount,
    normaliseStarCount,
    setStarCount,
    setStarBurstRangeMid,
    setStarSpeedSpread,
    setStarBurstLifeMid,
    setStarGravityUpper,
    setStarGravitySpread,
    setStarBurstScalar,
    setStarHeadSize,
    headGlowStrengthRange,
    setStarGlowStrength,
    starControls,
    controlScope,
  } = context;
  const layer = design.stars[layerKey];
  const layerEnabled = layer.enabled;
  const controlDisabled = sectionDisabled[layerKey];
  const toggleId = layerKey === 'outer' ? outerToggleId : coreToggleId;
  const isInnerLayer = layerKey === 'core';
  const burst = layer.burst;
  const starCount = layer.count;
  const starSize = layer.head.size;
  const glowStrength = layer.head.glowStrength;

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
          <SwitchField
            label="Head dot"
            checked={layer.head.visible}
            disabled={controlDisabled}
            hint="Render the luminous star head. Turn this off for a trail-only effect while keeping its trajectory alive."
            onChange={(value) => setStarHeadVisible(layerKey, value)}
          />
          {showStarCount ? (
            <SliderField
              inputKind="number"
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
            inputKind="number"
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
            min={STAR_SIZE_MIN}
            max={STAR_SIZE_MAX}
            step={STAR_SIZE_STEP}
            value={starSize}
            disabled={controlDisabled}
            hint="Size budget for each glowing star in this layer."
            onChange={(value) => setStarHeadSize(layerKey, value)}
          />
          <AppearanceField
            unit="multiplier"
            inputKind="knob"
            label="Glow strength"
            range={headGlowStrengthRange}
            value={glowStrength}
            disabled={controlDisabled}
            hint="Halo brightness around each star in this layer."
            onChange={(value) => setStarGlowStrength(layerKey, value)}
          />
        </div>

        {isInnerLayer ? renderStarColourPatternControls(context, layerKey, controlDisabled) : null}

        {renderStarAppearance(
          context,
          layerKey,
          controlDisabled,
          layerKey === 'outer' ? starControls : undefined,
        )}

        {controlScope === 'star' ? null : renderBurstTrailControls(context, layerKey)}
      </div>
    </PanelSection>
  );
}
