import { Field, FieldLabel } from '@/ui/patterns/Field';
import { SelectField } from '@/ui/patterns/SelectField';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { CONTROL_GRID_CLASS, SubSection } from '../ControlSections';
import { RendererField } from '../RendererField';

export function renderTrailLifetimeControls(
  context: RendererControlsContext,
  layerKey: StarLayerKey | undefined,
  disabled: boolean,
) {
  const lifetime = context.currentBurstTrail(layerKey).lifetime;
  const set = (key: keyof typeof lifetime, value: number | string) =>
    context.setBurstTrailNested(layerKey, 'lifetime', key, value);
  return (
    <SubSection title="Trail lifetime" defaultExpanded>
      <p className="text-muted-foreground mb-3 text-xs">
        How long each spark remains visible after leaving its star. Longer-lived sparks create
        longer trails.
      </p>
      <div className={CONTROL_GRID_CLASS}>
        <Field>
          <FieldLabel>Lifetime mode</FieldLabel>
          <SelectField
            value={lifetime.mode}
            onChange={(value) => set('mode', value)}
            options={[
              { value: 'fixed', label: 'Fixed duration' },
              { value: 'dynamic', label: 'Follow remaining star life' },
            ]}
            ariaLabel="Trail lifetime mode"
            disabled={disabled}
          />
        </Field>
        {lifetime.mode === 'fixed' ? (
          <RendererField
            label="Spark duration"
            inputKind="number"
            min={0.05}
            max={8}
            step={0.05}
            value={lifetime.baseSeconds}
            disabled={disabled}
            formatValue={(value) => `${value.toFixed(2)} s`}
            onChange={(value) => set('baseSeconds', value)}
          />
        ) : (
          <RendererField
            label="Share of remaining star life"
            min={0}
            max={200}
            step={1}
            value={lifetime.percent * 100}
            disabled={disabled}
            hint="At 50%, a spark emitted with two seconds of star life left lasts one second, plus afterglow."
            formatValue={(value) => `${Math.round(value)}%`}
            onChange={(value) => set('percent', value / 100)}
          />
        )}
        <RendererField
          label="Afterglow"
          inputKind="number"
          min={0}
          max={6}
          step={0.05}
          value={lifetime.afterglowSeconds}
          disabled={disabled}
          hint="Extra time added to each spark's duration."
          formatValue={(value) => `${value.toFixed(2)} s`}
          onChange={(value) => set('afterglowSeconds', value)}
        />
        <RendererField
          label="Lifetime variation"
          min={0}
          max={100}
          step={1}
          value={lifetime.variationPercent}
          disabled={disabled}
          hint="Random variation above and below each spark's duration. Zero gives every spark the same lifetime."
          formatValue={(value) => `±${Math.round(value)}%`}
          onChange={(value) => set('variationPercent', value)}
        />
      </div>
    </SubSection>
  );
}
