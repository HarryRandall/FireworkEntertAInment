import { isGroundGeometry } from '@showcrafter/fireworks/behaviours';
import type { FireworkDesign, StarLayerKey } from '@showcrafter/fireworks/design';
import type { RenderControlsProps } from './types.ts';

/** Fields replaced by the selected shape's own motion or emission algorithm. */
export function starMovementAvailability(design: FireworkDesign) {
  return {
    count: design.geometry !== 'single_tail',
    speed: design.geometry !== 'waterfall',
    gravity: design.geometry !== 'waterfall',
    reason:
      design.geometry === 'single_tail'
        ? 'Comets emit one star per enabled layer.'
        : design.geometry === 'waterfall'
          ? 'Set waterfall spread and gravity in Shape.'
          : null,
  };
}

export function unavailableControlReason(
  design: FireworkDesign,
  scope: RenderControlsProps['controlScope'],
  layer: StarLayerKey = 'outer',
): string | null {
  if (isGroundGeometry(design.geometry)) {
    if (scope === 'launch' || scope === 'launchShell' || scope === 'launchTrail')
      return 'This shape emits from the ground, so shell flight and rising sparks are not used. Adjust its spray in Burst → Shape.';
    if (scope === 'split')
      return 'Ground emitters do not split. Choose an aerial shape to use splitting.';
  }
  if (scope === 'split' && !design.stars.outer.enabled)
    return 'Enable outer stars in Burst to use splitting. Inner stars do not split.';
  if (
    (scope === 'strobe' || scope === 'crackle') &&
    !design.stars.outer.enabled &&
    !design.stars.core.enabled
  )
    return 'Enable an outer or inner star layer in Burst to use this effect.';
  if (scope === 'trail' && !design.stars[layer].enabled)
    return `Enable ${layer === 'core' ? 'inner' : 'outer'} stars in Burst to use their trails.`;
  return null;
}
