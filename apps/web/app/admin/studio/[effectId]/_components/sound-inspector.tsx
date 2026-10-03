/** The stored sound mix stays independent of browser preview mute preferences. */
'use client';
import { useEffect, useState } from 'react';
import { SETTINGS, setSetting } from '@showcrafter/fireworks/view';
import { SOUND_CONTROLS } from '@/lib/studio/sound-controls';
import {
  InspectorSection,
  InspectorToggle,
  RelativeSlider,
  type InspectorContext,
} from './inspector-controls';

const DEFAULT_LISTENER_M = 60; // Metres from the firing point, the prototype's listening position.
const LISTENER_MIN_M = 20; // Metres, prototype near-listener bound.
const LISTENER_MAX_M = 200; // Metres, prototype far-listener bound.
const listenerControl = {
  key: 'listener',
  label: 'Listener distance',
  low: 'Near',
  high: 'Far',
  min: LISTENER_MIN_M,
  max: LISTENER_MAX_M,
  step: 1,
};
/** Edits stored mix channels and preview-only listener distance; mute still requires a browser gesture. */
export function SoundInspector({
  document,
  disabled,
  edit,
  listenerDistanceM,
  onListenerDistanceChange,
}: InspectorContext & {
  listenerDistanceM: number | null;
  onListenerDistanceChange: (distanceM: number) => void;
}) {
  const [audible, setAudible] = useState(false);
  useEffect(() => {
    setAudible(SETTINGS.sound);
  }, []);
  return (
    <InspectorSection title="Sound mix" open={false}>
      <InspectorToggle
        label="Preview sound"
        value={audible}
        disabled={false}
        onChange={(value) => {
          setSetting('sound', value);
          setAudible(SETTINGS.sound);
        }}
      />
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
      <RelativeSlider
        control={listenerControl}
        value={listenerDistanceM ?? DEFAULT_LISTENER_M}
        disabled={false}
        onChange={onListenerDistanceChange}
      />
      <p className="text-muted-foreground text-xs">
        Listener distance changes the preview camera and sound arrival only. It is not saved in the
        firework.
      </p>
    </InspectorSection>
  );
}
