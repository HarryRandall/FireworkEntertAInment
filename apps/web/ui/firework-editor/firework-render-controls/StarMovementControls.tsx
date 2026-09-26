'use client';

import { starMovementAvailability } from '@showcrafter/firework-editor/availability';
import {
  STAR_COUNT_MAX,
  STAR_COUNT_MIN,
  STAR_LIFE_MAX,
  STAR_LIFE_MIN,
  STAR_SPEED_MAX,
  STAR_SPEED_MIN,
  STAR_GRAVITY_MIN,
  STAR_GRAVITY_MAX,
  rangeHalfWidth,
  rangeMid,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import {
  STAR_AIR_RESISTANCE_PERCENT_MAX,
  STAR_TERMINAL_VELOCITY_MAX,
  MAX_FOUNTAIN_RATE,
  type StarLayerKey,
} from '@showcrafter/fireworks/design';
import { CONTROL_GRID_CLASS, SubSection } from './ControlSections';
import { RendererField } from './RendererField';

export function StarMovementControls({
  context,
  layerKey,
  showCount = true,
}: {
  context: RendererControlsContext;
  layerKey: StarLayerKey;
  showCount?: boolean;
}) {
  const layer = context.design.stars[layerKey];
  const disabled = context.disabled || !layer.enabled;
  const availability = starMovementAvailability(context.design);
  return (
    <div className="space-y-4">
      {availability.reason ? (
        <p className="text-muted-foreground text-xs">{availability.reason}</p>
      ) : null}
      <div className={CONTROL_GRID_CLASS}>
        {context.design.geometry === 'fountain' && showCount ? (
          <RendererField
            inputKind="number"
            label="Sparks per second"
            value={layer.emissionRate}
            min={1}
            max={MAX_FOUNTAIN_RATE}
            step={0.1}
            disabled={disabled}
            onChange={(value) => context.setStarEmissionRate(layerKey, value)}
          />
        ) : availability.count && showCount ? (
          <RendererField
            inputKind="number"
            label={context.design.geometry === 'roman_candle' ? 'Shot count' : 'Star count'}
            value={layer.count}
            min={STAR_COUNT_MIN}
            max={STAR_COUNT_MAX}
            step={1}
            disabled={disabled}
            onChange={(value) => context.setStarCount(layerKey, value)}
          />
        ) : null}
        {availability.speed ? (
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
        ) : null}
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
        {availability.gravity ? (
          <RendererField
            label="Gravity"
            hint="Average vertical acceleration before the Shape gravity multiplier. Negative pulls down, positive pushes up. Set gravity and variation to zero for no acceleration."
            value={rangeMid(layer.burst.gravity)}
            min={STAR_GRAVITY_MIN}
            max={STAR_GRAVITY_MAX}
            step={0.01}
            disabled={disabled}
            onChange={(value) =>
              context.setStarBurstRangeMid(
                layerKey,
                'gravity',
                value,
                rangeHalfWidth(layer.burst.gravity),
              )
            }
          />
        ) : null}
        <RendererField
          label="Air resistance"
          hint="Resistance to movement. Zero removes both forms of air drag; higher values slow stars more quickly."
          value={layer.burst.airResistancePercent}
          min={0}
          max={STAR_AIR_RESISTANCE_PERCENT_MAX}
          step={1}
          formatValue={(value) => `${value}%`}
          disabled={disabled}
          onChange={(value) => context.setStarBurstScalar(layerKey, 'airResistancePercent', value)}
        />
        <RendererField
          label="Terminal fall speed"
          hint="Maximum downward speed in simulation units per second. Zero prevents downward movement."
          formatValue={(value) => `${value} units/s`}
          value={layer.burst.terminalVelocity}
          min={0}
          max={STAR_TERMINAL_VELOCITY_MAX}
          step={0.1}
          disabled={disabled}
          onChange={(value) => context.setStarBurstScalar(layerKey, 'terminalVelocity', value)}
        />
      </div>
      {availability.speed || availability.gravity ? (
        <SubSection title="Variation">
          <div className={CONTROL_GRID_CLASS}>
            {availability.speed ? (
              <RendererField
                label="Speed variation"
                min={0}
                max={Math.min(
                  rangeMid(layer.burst.speed) - STAR_SPEED_MIN,
                  STAR_SPEED_MAX - rangeMid(layer.burst.speed),
                )}
                step={0.05}
                value={rangeHalfWidth(layer.burst.speed)}
                disabled={disabled}
                hint="Random spread around the chosen speed. Zero gives every star the same starting speed."
                onChange={(value) => context.setStarSpeedSpread(layerKey, value)}
              />
            ) : null}
            {availability.gravity ? (
              <RendererField
                label="Gravity variation"
                min={0}
                max={Math.min(
                  rangeMid(layer.burst.gravity) - STAR_GRAVITY_MIN,
                  STAR_GRAVITY_MAX - rangeMid(layer.burst.gravity),
                )}
                step={0.01}
                value={rangeHalfWidth(layer.burst.gravity)}
                disabled={disabled}
                hint="Random spread either side of the chosen gravity, before the Shape multiplier. Zero gives every star the same gravity."
                onChange={(value) => context.setStarGravitySpread(layerKey, value)}
              />
            ) : null}
          </div>
        </SubSection>
      ) : null}
    </div>
  );
}
