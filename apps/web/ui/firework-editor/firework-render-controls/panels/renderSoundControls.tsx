'use client';
import {
  CONTROL_GRID_CLASS,
  PanelSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { renderBoomControl } from './renderBoomControl';
import { renderLaunchSoundControl } from './renderLaunchSoundControl';

export function renderSoundControls(context: RendererControlsContext) {
  const { isGroundEmitter, controlScope } = context;
  const soundContent = (
    <div className={CONTROL_GRID_CLASS}>
      {renderLaunchSoundControl(context)}
      {isGroundEmitter ? null : renderBoomControl(context)}
    </div>
  );

  if (controlScope === 'sound') {
    return soundContent;
  }

  return <PanelSection title="Sound">{soundContent}</PanelSection>;
}
