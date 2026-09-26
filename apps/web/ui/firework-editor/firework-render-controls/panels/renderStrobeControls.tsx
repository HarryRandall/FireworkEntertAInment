'use client';
import {
  CONTROL_GRID_CLASS,
  PanelSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Switch } from '@/ui/primitives/switch';
import { round2 } from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { RendererField as SliderField } from '../RendererField';

export function renderStrobeControls(context: RendererControlsContext) {
  const { strobeEnabled, strobeToggleId, setNestedRenderValue, disabled, design, sectionDisabled } =
    context;
  return (
    <PanelSection
      title="Strobe"
      inactive={!strobeEnabled}
      titleAccessory={<InfoTooltip text="Stars blink rapidly instead of burning steadily." />}
      action={
        <Switch
          id={strobeToggleId}
          aria-label="Strobe"
          checked={strobeEnabled}
          onCheckedChange={(value) => setNestedRenderValue('strobe', 'enabled', value)}
          disabled={disabled}
        />
      }
    >
      <div className={CONTROL_GRID_CLASS}>
        <SliderField
          label="Blink rate"
          min={2}
          max={28}
          step={0.5}
          value={design.strobe.frequencyHz}
          disabled={sectionDisabled.strobe}
          hint="Flashes per second."
          onChange={(value) => setNestedRenderValue('strobe', 'frequencyHz', value)}
        />
        <SliderField
          label="Blink duty"
          min={0.1}
          max={0.9}
          step={0.05}
          value={design.strobe.dutyCycle}
          disabled={sectionDisabled.strobe}
          hint="Fraction of each blink the star spends lit."
          onChange={(value) => setNestedRenderValue('strobe', 'dutyCycle', round2(value))}
        />
        <SliderField
          label="Strobe amount"
          min={0}
          max={100}
          step={1}
          value={design.strobe.amountPercent}
          disabled={sectionDisabled.strobe}
          hint="Percentage of stars that strobe; the rest burn steadily."
          onChange={(value) => setNestedRenderValue('strobe', 'amountPercent', value)}
        />
        <SliderField
          label="Dark size"
          min={0}
          max={60}
          step={0.5}
          value={design.strobe.dimPercent}
          disabled={sectionDisabled.strobe}
          hint="Star size during the dark phase, as a percentage of the lit size. 0 fully vanishes."
          onChange={(value) => setNestedRenderValue('strobe', 'dimPercent', round2(value))}
        />
        <SliderField
          label="Desync"
          min={0}
          max={1}
          step={0.001}
          value={design.strobe.desync}
          disabled={sectionDisabled.strobe}
          hint="Per-star phase offset. 0 blinks every star in unison; higher scatters the blinks."
          onChange={(value) => setNestedRenderValue('strobe', 'desync', value)}
        />
      </div>
    </PanelSection>
  );
}
