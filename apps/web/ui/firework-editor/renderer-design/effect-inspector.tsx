/** Multiple independent modifier chips retain the renderer's stored composition order. */
'use client';
import { Button } from '@/ui/primitives/button';
import { modifierSchema } from '@showcrafter/renderer/schema';
import { toggleModifier } from '@/lib/renderer-editor/inspector';
import { GHOST_CHANGE_CONTROL } from '@/lib/renderer-editor/ghost-controls';
import { MODIFIER_CONTROLS } from '@/lib/renderer-editor/modifier-controls';
import {
  InspectorSection,
  InspectorChoices,
  RelativeSlider,
  humanise,
  type LayerContext,
} from './inspector-controls';

import { HoverPreview } from './hover-preview';
import { layerChipPreview } from './chip-preview';

const MODIFIERS = modifierSchema.shape.kind.options;
const CRACKLE_SPREAD = ['burst', 'continuous'] as const;
const MAX_MODIFIERS = 16; // v1 maximum authored modifier instances per star group.
/** Toggles several modifiers and edits only each kernel's consumed settings. */
export function EffectInspector({
  document,
  layer,
  disabled,
  changeLayer,
  previewAddress,
}: LayerContext) {
  return (
    <div>
      <InspectorSection title="Modifiers">
        <ModifierChoices
          document={document}
          layer={layer}
          disabled={disabled}
          changeLayer={changeLayer}
          previewAddress={previewAddress}
        />
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

function ModifierChoices({
  document,
  layer,
  disabled,
  changeLayer,
  previewAddress,
}: Pick<LayerContext, 'document' | 'layer' | 'disabled' | 'changeLayer' | 'previewAddress'>) {
  return (
    <div role="group" aria-label="Modifiers" className="flex flex-wrap gap-1">
      {MODIFIERS.map((kind) => {
        const enabled = layer.modifiers.some((item) => item.kind === kind);
        return (
          <HoverPreview
            key={kind}
            name={humanise(kind)}
            address={previewAddress}
            document={layerChipPreview(document, layer, { modifier: kind })}
          >
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
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
          </HoverPreview>
        );
      })}
    </div>
  );
}
