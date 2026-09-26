'use client';

import {
  STAR_SIZE_MAX,
  STAR_SIZE_MIN,
  STAR_SIZE_STEP,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { SwitchField } from './ControlFields';
import { StarMovementControls } from './StarMovementControls';
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
            inputKind="slider"
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
      {part === 'movement' ? <StarMovementControls context={context} layerKey={layerKey} /> : null}
    </div>
  );
}
