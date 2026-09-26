'use client';
import { ColorField } from '@/ui/firework-editor/ColorField';
import { SwitchField } from '@/ui/firework-editor/firework-render-controls/ControlFields';
import {
  CONTROL_GRID_CLASS,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { SelectField } from '@/ui/patterns/SelectField';
import {
  formatMultiplier,
  hexToRgbObject,
  LAUNCH_SHELL_BRIGHTNESS_MAX,
  LAUNCH_SHELL_SHAPE_OPTIONS,
  LAUNCH_SHELL_SIZE_SCALE_MAX,
  LAUNCH_SHELL_SIZE_SCALE_MIN,
  rgbObjectToHex,
  round2,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { LaunchShellShape } from '@showcrafter/fireworks/design';
import {
  MAX_HEAD_GLOW_STRENGTH,
  MIN_HEAD_GLOW_STRENGTH,
} from '@showcrafter/fireworks/render-tuning';
import { RendererField as SliderField } from '../RendererField';

export function renderLaunchShellParticleControls(context: RendererControlsContext) {
  const { showLaunch, controlScope, design, disabled, setLaunchValue } = context;
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
        inputKind="slider"
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
