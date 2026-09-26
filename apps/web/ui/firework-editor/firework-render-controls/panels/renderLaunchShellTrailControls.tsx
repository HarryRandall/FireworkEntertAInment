'use client';
import {
  CONTROL_GRID_CLASS,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import {
  formatDegrees,
  formatMultiplier,
  round2,
  SHELL_TRAIL_CURVE_MAX,
  SHELL_TRAIL_CURVE_MIN,
  SHELL_TRAIL_SPREAD_ANGLE_MAX,
  SHELL_TRAIL_TUBE_DIAMETER_MAX,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { RendererField as SliderField } from '../RendererField';

export function renderLaunchShellTrailControls(context: RendererControlsContext) {
  const { showLaunch, controlScope, design, disabled, setLaunchNestedValue } = context;
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
        onChange={(value) => setLaunchNestedValue('shell', 'trail', 'tubeDiameter', round2(value))}
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
