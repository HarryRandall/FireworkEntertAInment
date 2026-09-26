'use client';
import { Switch } from '@/ui/primitives/switch';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { PanelSection, SubSection } from '../ControlSections';
import { EffectNumericFields } from '../EffectNumericFields';

export function renderStrobeControls(context: RendererControlsContext) {
  return (
    <PanelSection
      title="Blinking stars"
      inactive={!context.strobeEnabled}
      action={
        <Switch
          aria-label="Strobe"
          checked={context.strobeEnabled}
          onCheckedChange={(value) => context.setNestedRenderValue('strobe', 'enabled', value)}
          disabled={context.disabled}
        />
      }
    >
      <div className="space-y-4">
        <p className="text-muted-foreground text-xs">
          Applies to both enabled star layers. Trails keep emitting while the heads blink.
        </p>
        <SubSection title="Flash rhythm" defaultExpanded>
          <EffectNumericFields
            context={context}
            section="strobe"
            fields={['frequencyHz', 'dutyCycle']}
          />
        </SubSection>
        <SubSection title="Which stars blink" defaultExpanded>
          <EffectNumericFields
            context={context}
            section="strobe"
            fields={['amountPercent', 'desync']}
          />
        </SubSection>
        <SubSection title="Between flashes">
          <EffectNumericFields context={context} section="strobe" fields={['dimPercent']} />
        </SubSection>
      </div>
    </PanelSection>
  );
}
