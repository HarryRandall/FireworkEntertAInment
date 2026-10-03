/** Launch controls edit the stored climb and tail rather than introducing another design format. */
'use client';
import { launchSchema } from '@showcrafter/fireworks/schema';
import { changeLaunchHeight } from '@/lib/studio/inspector';
import { LAUNCH_CONTROLS } from '@/lib/studio/launch-controls';
import {
  InspectorChoices,
  InspectorSection,
  RelativeSlider,
  type InspectorContext,
} from './inspector-controls';

import { QuickAdjustments, LAUNCH_QUICK } from './quick-adjustments';

import { libraryChipPreview } from './chip-preview';

const TAILS = launchSchema.shape.tail.options;
/** Edits climb, smoke, lean and every built-in renderer tail with square-root height/time coupling. */
export function LaunchInspector(context: InspectorContext) {
  const { document, edit, disabled } = context;
  const launch = document.launch;
  if (!launch) return <p>This firework starts at ground level.</p>;
  return (
    <div>
      <QuickAdjustments context={context} controls={LAUNCH_QUICK} />
      <InspectorSection title="Climb and fine controls">
        <InspectorChoices
          label="Tail style"
          climbPreview
          preview={(tail) => libraryChipPreview(document, null, 'tails', tail)}
          items={TAILS}
          value={launch.tail}
          disabled={disabled}
          onChange={(tail) => {
            edit((draft) => {
              if (draft.launch) draft.launch.tail = tail;
            });
          }}
        />
        {LAUNCH_CONTROLS.map((control) => (
          <RelativeSlider
            key={control.key}
            control={control}
            value={launch[control.key]}
            disabled={disabled}
            onChange={(value) => {
              edit((draft) => {
                if (!draft.launch) return;
                if (control.key === 'height_m') changeLaunchHeight(draft, value);
                else draft.launch[control.key] = value;
              });
            }}
          />
        ))}
      </InspectorSection>
    </div>
  );
}
