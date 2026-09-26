'use client';
import { PanelSection } from '@/ui/firework-editor/firework-render-controls/ControlSections';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { renderLaunchShellParticleControls } from './renderLaunchShellParticleControls';
import { renderLaunchShellTrailControls } from './renderLaunchShellTrailControls';
import { renderLiftParticleControls } from './renderLiftParticleControls';
import { renderLiftVelocityControl } from './renderLiftVelocityControl';

export function renderLaunchControls(
  context: RendererControlsContext,
  includeLiftParticles = false,
) {
  const { controlScope } = context;
  const launchContent = (
    <div className="space-y-5">
      {renderLiftVelocityControl(
        context,
        'Launch speed, which sets the burst height. Small keeps effects low; High throws them taller.',
      )}
      {renderLaunchShellParticleControls(context)}
      {renderLaunchShellTrailControls(context)}
    </div>
  );

  if (controlScope === 'launch') {
    return (
      <div className="space-y-5">
        {launchContent}
        {includeLiftParticles ? renderLiftParticleControls(context) : null}
      </div>
    );
  }

  return (
    <>
      <PanelSection title="Launch">{launchContent}</PanelSection>

      {includeLiftParticles ? renderLiftParticleControls(context) : null}
    </>
  );
}
