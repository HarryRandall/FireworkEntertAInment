'use client';
import {
  CONTROL_GRID_CLASS,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import {
  formatPercent,
  round2,
  STAR_OPENING_PERCENT_MAX,
  STAR_OPENING_PERCENT_MIN,
  TRAIL_OPENING_BRIGHTNESS_MAX,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { RendererField as SliderField } from '../RendererField';

export function renderBurstTrailOpeningControls(
  context: RendererControlsContext,
  layerKey: StarLayerKey | undefined,
) {
  const { currentBurstTrail, disabled, design, setBurstTrailOpeningValue } = context;
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
