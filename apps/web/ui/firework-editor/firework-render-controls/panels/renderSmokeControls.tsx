'use client';
import { cn } from '@/lib/utils';
import { ColorField } from '@/ui/firework-editor/ColorField';
import { SwitchField } from '@/ui/firework-editor/firework-render-controls/ControlFields';
import {
  AdvancedControls,
  CONTROL_GRID_CLASS,
  PanelSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Switch } from '@/ui/primitives/switch';
import {
  formatMultiplier,
  formatPercent,
  formatProbability,
  formatSeconds,
  hexToRgbObject,
  LAUNCH_SMOKE_DRIFT_MAX,
  LAUNCH_SMOKE_HEIGHT_MAX,
  LAUNCH_SMOKE_PARTICLES_MAX,
  LAUNCH_SMOKE_SIZE_MAX,
  LAUNCH_SMOKE_SPREAD_MAX,
  rgbObjectToHex,
  round2,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { RendererField as SliderField } from '../RendererField';

export function renderSmokeControls(context: RendererControlsContext) {
  const {
    showLaunch,
    controlScope,
    design,
    sectionDisabled,
    setLaunchValue,
    smokeEnabled,
    disabled,
    smokeToggleId,
  } = context;
  if (!showLaunch && controlScope !== 'smoke') return null;

  const smoke = design.launch.smoke;
  const smokeContent = (
    <div className={CONTROL_GRID_CLASS}>
      <ColorField
        label="Smoke colour"
        value={rgbObjectToHex(smoke.colour) ?? '#8f9298'}
        disabled={sectionDisabled.smoke}
        hint="Tint used by both mortar smoke and the puffs emitted along the rising shell path."
        onChange={(value) => setLaunchValue('smoke', 'colour', hexToRgbObject(value ?? '#8f9298'))}
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
