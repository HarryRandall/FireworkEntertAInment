'use client';
import { unavailableControlReason } from '@showcrafter/firework-editor/availability';
import type { RenderControlsProps } from '@showcrafter/firework-editor/types';
import { useRenderControls } from '@showcrafter/firework-editor/use-render-controls';
import { renderBurstTrailControls } from './firework-render-controls/panels/renderBurstTrailControls';
import { renderCrackleControls } from './firework-render-controls/panels/renderCrackleControls';
import { renderGeometryControls } from './firework-render-controls/panels/renderGeometryControls';
import { renderLaunchControls } from './firework-render-controls/panels/renderLaunchControls';
import { renderLaunchShellParticleControls } from './firework-render-controls/panels/renderLaunchShellParticleControls';
import { renderLaunchShellTrailControls } from './firework-render-controls/panels/renderLaunchShellTrailControls';
import { renderLiftParticleControls } from './firework-render-controls/panels/renderLiftParticleControls';
import { renderLiftVelocityControl } from './firework-render-controls/panels/renderLiftVelocityControl';
import { renderSmokeControls } from './firework-render-controls/panels/renderSmokeControls';
import { renderSoundControls } from './firework-render-controls/panels/renderSoundControls';
import { renderSplitControls } from './firework-render-controls/panels/renderSplitControls';
import { renderStarLayerControls } from './firework-render-controls/panels/renderStarLayerControls';
import { renderStrobeControls } from './firework-render-controls/panels/renderStrobeControls';
import { StarPartControls } from './firework-render-controls/StarPartControls';
export type { JsonRecord } from '@showcrafter/firework-editor/types';

export function FireworkRenderControls(props: RenderControlsProps) {
  const reason = unavailableControlReason(props.design, props.controlScope, props.layer);
  return (
    <div className="space-y-4">
      {reason ? (
        <p
          className="text-muted-foreground border-border rounded-md border p-3 text-xs"
          role="status"
        >
          {reason}
        </p>
      ) : null}
      <RenderControlPanels {...props} disabled={props.disabled || Boolean(reason)} />
    </div>
  );
}

function RenderControlPanels(props: RenderControlsProps) {
  const context = useRenderControls(props);
  if (props.part === 'flight')
    return (
      <>{renderLiftVelocityControl(context, 'Set the launch speed and resulting burst height.')}</>
    );
  if (props.part)
    return (
      <StarPartControls context={context} layerKey={props.layer ?? 'outer'} part={props.part} />
    );
  const { controlScope, showLaunch, afterBurst } = context;

  if (controlScope === 'trail') {
    return <>{renderBurstTrailControls(context)}</>;
  }

  if (controlScope === 'star') {
    return <>{renderStarLayerControls(context, 'outer', 'Star')}</>;
  }

  if (controlScope === 'starInner') {
    return <>{renderStarLayerControls(context, 'core', 'Star Inner')}</>;
  }

  if (controlScope === 'launchShell') {
    return <>{renderLaunchShellParticleControls(context)}</>;
  }

  if (controlScope === 'launchTrail') {
    return (
      <div className="space-y-5">
        {renderLaunchShellTrailControls(context)}
        {renderLiftParticleControls(context)}
      </div>
    );
  }

  if (controlScope === 'launch') return <>{renderLaunchControls(context, true)}</>;

  if (controlScope === 'geometry') return <>{renderGeometryControls(context)}</>;

  if (controlScope === 'smoke') return <>{renderSmokeControls(context)}</>;

  if (controlScope === 'strobe') return <>{renderStrobeControls(context)}</>;

  if (controlScope === 'crackle') return <>{renderCrackleControls(context)}</>;

  if (controlScope === 'split') return <>{renderSplitControls(context)}</>;

  if (controlScope === 'sound') return <>{renderSoundControls(context)}</>;

  return (
    <>
      {showLaunch ? renderLaunchControls(context) : null}

      {afterBurst}

      {renderLiftParticleControls(context)}

      {renderSmokeControls(context)}

      {renderStarLayerControls(context, 'outer', 'Star')}

      {renderStarLayerControls(context, 'core', 'Star Inner')}

      {renderGeometryControls(context)}

      {showLaunch ? renderSoundControls(context) : null}

      {renderStrobeControls(context)}

      {renderCrackleControls(context)}

      {renderSplitControls(context)}
    </>
  );
}
