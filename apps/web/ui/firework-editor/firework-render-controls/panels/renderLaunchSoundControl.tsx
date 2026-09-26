'use client';
import { SwitchField } from '@/ui/firework-editor/firework-render-controls/ControlFields';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';

export function renderLaunchSoundControl(context: RendererControlsContext) {
  const { launchSoundValue, disabled, setLaunchSoundValue } = context;
  return (
    <SwitchField
      label="Launch sound"
      checked={launchSoundValue}
      disabled={disabled}
      hint="Mortar lift sound when the shell leaves the tube."
      onChange={setLaunchSoundValue}
    />
  );
}
