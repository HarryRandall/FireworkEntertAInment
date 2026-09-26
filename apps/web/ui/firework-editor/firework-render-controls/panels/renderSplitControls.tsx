'use client';
import {
  CONTROL_GRID_CLASS,
  PanelSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Switch } from '@/ui/primitives/switch';
import { formatProbability, round2 } from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { RendererField as SliderField } from '../RendererField';

export function renderSplitControls(context: RendererControlsContext) {
  const {
    showSplitControls,
    controlScope,
    design,
    splitToggleId,
    setNestedRenderValue,
    disabled,
    sectionDisabled,
  } = context;
  if (!showSplitControls && controlScope !== 'split') return null;

  return (
    <PanelSection
      title="Split"
      inactive={!design.split.enabled}
      titleAccessory={<InfoTooltip text="Crossette stars split into smaller fragments." />}
      action={
        <Switch
          id={splitToggleId}
          aria-label="Split"
          checked={design.split.enabled}
          onCheckedChange={(value) => setNestedRenderValue('split', 'enabled', value)}
          disabled={disabled}
        />
      }
    >
      {design.split.enabled ? (
        <div className={CONTROL_GRID_CLASS}>
          <SliderField
            label="Split fragments"
            min={2}
            max={8}
            step={1}
            value={design.split.fragments}
            disabled={sectionDisabled.split}
            hint="How many pieces each crossette star splits into."
            onChange={(value) => setNestedRenderValue('split', 'fragments', value)}
          />
          <SliderField
            label="Split speed"
            min={0.4}
            max={4}
            step={0.05}
            value={design.split.speed}
            disabled={sectionDisabled.split}
            hint="How hard the fragments kick away from the split."
            onChange={(value) => setNestedRenderValue('split', 'speed', round2(value))}
          />
          <SliderField
            label="Split timing"
            min={0.15}
            max={0.85}
            step={0.01}
            value={design.split.delayRatio}
            formatValue={formatProbability}
            showNumberInput
            inputAriaLabel="Split timing value"
            disabled={sectionDisabled.split}
            hint="Point in the parent star's life when it divides. Lower splits earlier; higher splits near the end."
            onChange={(value) => setNestedRenderValue('split', 'delayRatio', round2(value))}
          />
          <SliderField
            label="Fragment life"
            min={0.1}
            max={6}
            step={0.05}
            value={design.split.lifeBaseSeconds}
            disabled={sectionDisabled.split}
            hint="Minimum fragment burn time in seconds."
            onChange={(value) => setNestedRenderValue('split', 'lifeBaseSeconds', round2(value))}
          />
          <SliderField
            label="Fragment life spread"
            min={0}
            max={6}
            step={0.05}
            value={design.split.lifeVariationSeconds}
            disabled={sectionDisabled.split}
            hint="Random extra burn time on top of the base, in seconds."
            onChange={(value) =>
              setNestedRenderValue('split', 'lifeVariationSeconds', round2(value))
            }
          />
          <SliderField
            label="Fragment size"
            min={5}
            max={200}
            step={1}
            value={design.split.headSizePercent}
            disabled={sectionDisabled.split}
            hint="Fragment head size as a percentage of the parent star."
            onChange={(value) => setNestedRenderValue('split', 'headSizePercent', value)}
          />
          <SliderField
            label="Fragment trail life"
            min={5}
            max={300}
            step={1}
            value={design.split.trailLifePercent}
            disabled={sectionDisabled.split}
            hint="Fragment trail persistence relative to the parent trail."
            onChange={(value) => setNestedRenderValue('split', 'trailLifePercent', value)}
          />
        </div>
      ) : null}
    </PanelSection>
  );
}
