/** The stored sound mix stays independent of browser preview mute preferences. */
'use client';
import { SOUND_CONTROLS } from '@/lib/renderer-editor/sound-controls';
import { InspectorSection, RelativeSlider, type InspectorContext } from './inspector-controls';

/** Edits the persisted sound mix used by the preview and saved design. */
export function SoundInspector({ document, disabled, edit }: InspectorContext) {
  return (
    <InspectorSection title="Sound mix">
      {SOUND_CONTROLS.map((control) => (
        <RelativeSlider
          key={control.key}
          control={control}
          value={document.sound[control.key]}
          disabled={disabled}
          onChange={(value) => {
            edit((draft) => {
              draft.sound[control.key] = value;
            });
          }}
        />
      ))}
    </InspectorSection>
  );
}
