/** Each break has its own apex-relative clock, centre flash, ring and fade controls. */
'use client';
import { Plus, Trash2 } from 'lucide-react';
import { addBreak, removeBreak, setCorePart } from '@/lib/renderer-editor/inspector';
import { CORE_CONTROLS, FADE_CONTROLS, BREAK_CONTROLS } from '@/lib/renderer-editor/burst-controls';
import { Button } from '@/ui/primitives/button';
import {
  InspectorColour,
  InspectorSection,
  InspectorToggle,
  RelativeSlider,
  type InspectorContext,
} from './inspector-controls';

const MAX_BREAKS = 64; // v1 schema's break-list bound.
/** Adds/removes complete breaks and edits each centre and fade without touching published versions. */
export function BurstInspector(context: InspectorContext) {
  return (
    <div className="grid gap-3">
      {context.document.breaks.map((burst, index) => (
        <BurstControls key={index} context={context} index={index} burst={burst} />
      ))}
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={context.disabled || context.document.breaks.length >= MAX_BREAKS}
        onClick={() => {
          context.edit(addBreak);
        }}
      >
        <Plus aria-hidden="true" />
        Add break
      </Button>
    </div>
  );
}
function BurstControls({
  context,
  index,
  burst,
}: {
  context: InspectorContext;
  index: number;
  burst: InspectorContext['document']['breaks'][number];
}) {
  const change = (update: (value: typeof burst) => void) => {
    context.edit((draft) => {
      const target = draft.breaks.at(index);
      if (target) update(target);
    });
  };
  return (
    <InspectorSection title={`Break ${String(index + 1)}`}>
      <RelativeSlider
        control={BREAK_CONTROLS[0]}
        value={burst.at_s}
        disabled={context.disabled}
        onChange={(value) => {
          change((target) => {
            target.at_s = value;
          });
        }}
      />
      <CoreControls burst={burst} index={index} disabled={context.disabled} change={change} />
      {CORE_CONTROLS.map((control) => (
        <RelativeSlider
          key={control.key}
          control={control}
          value={burst.core[control.key]}
          disabled={context.disabled}
          onChange={(value) => {
            change((target) => {
              target.core[control.key] = value;
            });
          }}
        />
      ))}
      <InspectorSection title="Fade" open={false}>
        {FADE_CONTROLS.map((control) => (
          <RelativeSlider
            key={control.key}
            control={control}
            value={burst.fade[control.key]}
            disabled={context.disabled}
            onChange={(value) => {
              change((target) => {
                target.fade[control.key] = value;
              });
            }}
          />
        ))}
      </InspectorSection>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive justify-self-start"
        disabled={context.disabled || context.document.breaks.length <= 1}
        onClick={() => {
          context.edit((draft) => {
            removeBreak(draft, index);
          });
        }}
      >
        <Trash2 aria-hidden="true" />
        Remove break {index + 1}
      </Button>
    </InspectorSection>
  );
}

function CoreControls({
  burst,
  index,
  disabled,
  change,
}: {
  burst: InspectorContext['document']['breaks'][number];
  index: number;
  disabled: boolean;
  change: (update: (burst: InspectorContext['document']['breaks'][number]) => void) => void;
}) {
  return (
    <div className="grid gap-1">
      <InspectorToggle
        label={`Core flash ${String(index + 1)}`}
        value={burst.core.enabled && burst.core.flash_on}
        disabled={disabled}
        onChange={(value) => {
          change((target) => {
            setCorePart(target.core, 'flash_on', value);
          });
        }}
      />
      <InspectorToggle
        label={`Centre ring ${String(index + 1)}`}
        value={burst.core.enabled && burst.core.ring}
        disabled={disabled}
        onChange={(value) => {
          change((target) => {
            setCorePart(target.core, 'ring', value);
          });
        }}
      />
      <InspectorColour
        label="Ring colour"
        name={`Ring colour ${String(index + 1)}`}
        value={burst.core.colour}
        disabled={disabled}
        onChange={(colour) => {
          change((target) => {
            target.core.colour = colour;
          });
        }}
      />
    </div>
  );
}
