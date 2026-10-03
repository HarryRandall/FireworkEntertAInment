/** Multiple independent modifier chips retain the renderer's stored composition order. */
'use client';
import { modifierSchema } from '@showcrafter/fireworks/schema';
import { toggleModifier } from '@/lib/studio/inspector';
import { GHOST_CHANGE_CONTROL } from '@/lib/studio/ghost-controls';
import { MODIFIER_CONTROLS } from '@/lib/studio/modifier-controls';
import { Button } from '@/ui/primitives/button';
import {
  InspectorSection,
  InspectorChoices,
  RelativeSlider,
  humanise,
  type LayerContext,
} from './inspector-controls';

const MODIFIERS = modifierSchema.shape.kind.options;
const CRACKLE_SPREAD = ['burst', 'continuous'] as const;
const MAX_MODIFIERS = 16; // v1 maximum authored modifier instances per star group.
/** Toggles several modifiers and edits only each kernel's consumed settings. */
export function EffectInspector({ layer, disabled, changeLayer }: LayerContext) {
  return (
    <div>
      <InspectorSection title="Modifiers">
        <div role="group" aria-label="Modifiers" className="flex flex-wrap gap-1">
          {MODIFIERS.map((kind) => {
            const enabled = layer.modifiers.some((item) => item.kind === kind);
            return (
              <Button
                key={kind}
                size="sm"
                variant={enabled ? 'secondary' : 'outline'}
                aria-pressed={enabled}
                disabled={disabled || (!enabled && layer.modifiers.length >= MAX_MODIFIERS)}
                onClick={() => {
                  changeLayer((target) => {
                    toggleModifier(target, kind);
                  });
                }}
              >
                {humanise(kind)}
              </Button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          Combine looks. Selected modifiers run in their saved order. Whistle has no layer settings.
        </p>
      </InspectorSection>
      {layer.modifiers.map((modifier, index) => (
        <InspectorSection
          key={`${modifier.kind}:${String(index)}`}
          title={`${humanise(modifier.kind)} settings`}
        >
          {modifier.kind === 'crackle' && (
            <InspectorChoices
              label="Crackle spread"
              items={CRACKLE_SPREAD}
              value={modifier.spread}
              disabled={disabled}
              onChange={(spread) => {
                changeLayer((target) => {
                  const item = target.modifiers.at(index);
                  if (item) item.spread = spread;
                });
              }}
            />
          )}
          {MODIFIER_CONTROLS[modifier.kind]
            .filter(
              (control) =>
                !(
                  modifier.kind === 'crackle' &&
                  modifier.spread === 'continuous' &&
                  control.key === 'count'
                ),
            )
            .map((control) => (
              <RelativeSlider
                key={control.key}
                control={{
                  ...control,
                  label: `${humanise(modifier.kind)} ${control.label.toLowerCase()}`,
                }}
                value={modifier[control.key]}
                disabled={disabled}
                onChange={(value) => {
                  changeLayer((target) => {
                    const item = target.modifiers.at(index);
                    if (item) item[control.key] = value;
                  });
                }}
              />
            ))}
          {modifier.kind === 'ghost' && layer.colour.reignition && (
            <RelativeSlider
              control={GHOST_CHANGE_CONTROL}
              value={layer.colour.reignition.at}
              disabled={disabled}
              onChange={(value) => {
                changeLayer((target) => {
                  if (target.colour.reignition) target.colour.reignition.at = value;
                });
              }}
            />
          )}
          {MODIFIER_CONTROLS[modifier.kind].length === 0 && (
            <p className="text-muted-foreground text-xs">
              No numeric settings are read for this modifier.
            </p>
          )}
        </InspectorSection>
      ))}
    </div>
  );
}
