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
  STAR_SIZE_MAX,
  STAR_SIZE_MIN,
  STAR_SIZE_STEP,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { StarMovementControls } from '../StarMovementControls';
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
            inputKind="slider"
            label="Glow strength"
            range={headGlowStrengthRange}
            value={glowStrength}
            disabled={controlDisabled}
            hint="Halo brightness around each star in this layer."
            onChange={(value) => setStarGlowStrength(layerKey, value)}
          />
        </div>

        <StarMovementControls context={context} layerKey={layerKey} showCount={showStarCount} />

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
