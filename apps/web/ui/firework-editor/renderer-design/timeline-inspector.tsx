'use client';
import { LAUNCH_CONTROLS } from '@/lib/renderer-editor/launch-controls';
import { BREAK_CONTROLS } from '@/lib/renderer-editor/burst-controls';
import { STARS_CONTROLS } from '@/lib/renderer-editor/star-controls';
import { InspectorSection, RelativeSlider, type InspectorContext } from './inspector-controls';

/** Edits authored seconds without changing the legacy scheduling duration. */
export function TimelineInspector({ document, disabled, edit }: InspectorContext) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Scrub the preview using its player. Catalogue duration remains independently saved for the
        existing show renderer.
      </p>
      {document.launch &&
        LAUNCH_CONTROLS.filter((control) => control.key === 'time_s').map((control) => (
          <RelativeSlider
            key={control.key}
            control={control}
            value={document.launch?.time_s ?? 0}
            disabled={disabled}
            onChange={(value) =>
              edit((draft) => {
                if (draft.launch) draft.launch.time_s = value;
              })
            }
          />
        ))}
      {document.breaks.map((burst, index) => (
        <InspectorSection key={index} title={`Break ${index + 1}`}>
          {BREAK_CONTROLS.map((control) => (
            <RelativeSlider
              key={control.key}
              control={control}
              value={burst[control.key]}
              disabled={disabled}
              onChange={(value) =>
                edit((draft) => {
                  draft.breaks[index][control.key] = value;
                })
              }
            />
          ))}
          {burst.layers.map((layer) => (
            <InspectorSection key={layer.id} title={layer.name}>
              {STARS_CONTROLS.filter(
                (control) => control.key === 'delay_s' || control.key === 'life_s',
              ).map((control) => (
                <RelativeSlider
                  key={control.key}
                  control={control}
                  value={layer[control.key]}
                  disabled={disabled}
                  onChange={(value) =>
                    edit((draft) => {
                      const target = draft.breaks[index].layers.find(
                        (item) => item.id === layer.id,
                      );
                      if (target) target[control.key] = value;
                    })
                  }
                />
              ))}
            </InspectorSection>
          ))}
        </InspectorSection>
      ))}
    </div>
  );
}
