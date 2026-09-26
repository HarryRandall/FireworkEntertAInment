'use client';

import {
  STAR_COUNT_MAX,
  STAR_COUNT_MIN,
  STAR_LIFE_MAX,
  STAR_LIFE_MIN,
  STAR_SIZE_MAX,
  STAR_SIZE_MIN,
  STAR_SIZE_STEP,
  STAR_SPEED_MAX,
  STAR_SPEED_MIN,
  rangeHalfWidth,
  rangeMid,
  rangeUpper,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import {
  STAR_AIR_RESISTANCE_PERCENT_MAX,
  STAR_TERMINAL_VELOCITY_MAX,
} from '@showcrafter/fireworks/design';
import { SwitchField } from './ControlFields';
import { renderBurstTrailControls } from './panels/renderBurstTrailControls';
import { renderStarAppearance } from './panels/renderStarAppearance';
import { renderStarColourPatternControls } from './panels/renderStarColourPatternControls';
import { RendererField } from './RendererField';

export function StarPartControls({
  context,
  layerKey,
  part,
}: {
  context: RendererControlsContext;
  layerKey: StarLayerKey;
  part: 'appearance' | 'colours' | 'movement' | 'trails';
}) {
  const layer = context.design.stars[layerKey];
  const disabled = context.disabled || !layer.enabled;
  return (
    <div className="space-y-5">
      {part === 'trails' ? (
        !layer.enabled ? (
          <p className="text-muted-foreground text-xs">
            Enable {layerKey === 'core' ? 'inner' : 'outer'} stars in Burst to use their trails.
          </p>
        ) : null
      ) : (
        <SwitchField
          label={layerKey === 'core' ? 'Inner stars' : 'Outer stars'}
          hint="Turn this layer off without losing its settings."
          checked={layer.enabled}
          disabled={context.disabled}
          onChange={(value) => context.setStarLayerEnabled(layerKey, value)}
        />
      )}
      {part === 'appearance' ? (
        <>
          <SwitchField
            label="Visible star heads"
            hint="Hide the glowing points while keeping this layer's movement and trails."
            checked={layer.head.visible}
            disabled={disabled}
            onChange={(value) => context.setStarHeadVisible(layerKey, value)}
          />
          <RendererField
            label="Star size"
            value={layer.head.size}
            min={STAR_SIZE_MIN}
            max={STAR_SIZE_MAX}
            step={STAR_SIZE_STEP}
            disabled={disabled}
            onChange={(value) => context.setStarHeadSize(layerKey, value)}
          />
          <RendererField
            inputKind="knob"
            label="Glow strength"
            value={layer.head.glowStrength}
            min={0}
            max={3}
            step={0.01}
            disabled={disabled}
            onChange={(value) => context.setStarGlowStrength(layerKey, value)}
          />
          {renderStarAppearance(context, layerKey, disabled)}
        </>
      ) : null}
      {part === 'colours' ? renderStarColourPatternControls(context, layerKey, disabled) : null}
      {part === 'trails' ? renderBurstTrailControls(context, layerKey) : null}
      {part === 'movement' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <RendererField
            inputKind="number"
            label="Star count"
            value={layer.count}
            min={STAR_COUNT_MIN}
            max={STAR_COUNT_MAX}
            step={1}
            disabled={disabled}
            onChange={(value) => context.setStarCount(layerKey, value)}
          />
          <RendererField
            label="Spread"
            hint="How far the stars travel from the centre."
            value={rangeMid(layer.burst.speed)}
            min={STAR_SPEED_MIN}
            max={STAR_SPEED_MAX}
            step={0.1}
            disabled={disabled}
            onChange={(value) =>
              context.setStarBurstRangeMid(
                layerKey,
                'speed',
                value,
                rangeHalfWidth(layer.burst.speed),
              )
            }
          />
          <RendererField
            inputKind="number"
            label="Hang time"
            value={rangeMid(layer.burst.life)}
            min={STAR_LIFE_MIN}
            max={STAR_LIFE_MAX}
            step={0.05}
            formatValue={(value) => `${value.toFixed(2)} s`}
            disabled={disabled}
            onChange={(value) => context.setStarBurstLifeMid(layerKey, value)}
          />
          <RendererField
            label="Gravity"
            hint="Negative values make stars fall; zero keeps them floating."
            value={rangeUpper(layer.burst.gravity)}
            min={-2}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(value) => context.setStarGravityUpper(layerKey, value)}
          />
          <RendererField
            label="Air resistance"
            value={layer.burst.airResistancePercent}
            min={0}
            max={STAR_AIR_RESISTANCE_PERCENT_MAX}
            step={1}
            formatValue={(value) => `${value}%`}
            disabled={disabled}
            onChange={(value) =>
              context.setStarBurstScalar(layerKey, 'airResistancePercent', value)
            }
          />
          <RendererField
            label="Terminal fall speed"
            value={layer.burst.terminalVelocity}
            min={0}
            max={STAR_TERMINAL_VELOCITY_MAX}
            step={0.1}
            disabled={disabled}
            onChange={(value) => context.setStarBurstScalar(layerKey, 'terminalVelocity', value)}
          />
        </div>
      ) : null}
    </div>
  );
}
