'use client';
import { Switch } from '@/ui/primitives/switch';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { isGroundGeometry } from '@showcrafter/fireworks/behaviours';
import { PanelSection, SubSection } from '../ControlSections';
import { EffectNumericFields } from '../EffectNumericFields';

export function renderSplitControls(context: RendererControlsContext) {
  const unavailable = isGroundGeometry(context.design.geometry);
  const disabled = context.disabled || unavailable || !context.design.stars.outer.enabled;
  const fieldsContext = {
    ...context,
    sectionDisabled: {
      ...context.sectionDisabled,
      split: disabled || !context.design.split.enabled,
    },
  };
  return (
    <PanelSection
      title="Splitting outer stars"
      inactive={disabled || !context.design.split.enabled}
      action={
        <Switch
          aria-label="Split"
          checked={context.design.split.enabled}
          onCheckedChange={(value) => context.setNestedRenderValue('split', 'enabled', value)}
          disabled={disabled}
        />
      }
    >
      <div className="space-y-4">
        <p className="text-muted-foreground text-xs">
          {unavailable
            ? 'Ground emitters do not split. Choose an aerial shape to use these settings.'
            : !context.design.stars.outer.enabled
              ? 'Enable outer stars in Burst to use splitting.'
              : 'Each outer star divides once. Fragments inherit its colour, appearance and trail settings; inner stars stay intact.'}
        </p>
        <SubSection title="When and how many" defaultExpanded>
          <EffectNumericFields
            context={fieldsContext}
            section="split"
            fields={['fragments', 'delayRatio']}
          />
        </SubSection>
        <SubSection title="Fragment appearance and movement" defaultExpanded>
          <EffectNumericFields
            context={fieldsContext}
            section="split"
            fields={['headSizePercent', 'speed']}
          />
        </SubSection>
        <SubSection title="Burn and trail duration">
          <EffectNumericFields
            context={fieldsContext}
            section="split"
            fields={['lifeBaseSeconds', 'lifeVariationSeconds', 'trailLifePercent']}
          />
        </SubSection>
      </div>
    </PanelSection>
  );
}
