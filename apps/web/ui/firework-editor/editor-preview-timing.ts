import type { FireworkDesign, LaunchPosition } from '@/lib/fireworks/design';
import {
  estimateFireworkDesignTiming,
  estimateFireworkLiftTimeSeconds,
} from '@/lib/fireworks/timing';
import type { EditorPreviewTick } from './FireworkEditorShell';

/** Single origin launch position shared by the admin editor previews. */
export const PREVIEW_LAUNCH_POSITIONS: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];

export function estimateLiftTimeSeconds(design: FireworkDesign) {
  return estimateFireworkLiftTimeSeconds(design);
}

export function estimateLaunchPreviewDurationSeconds({
  design,
  cueTimeSeconds,
}: {
  design: FireworkDesign;
  cueTimeSeconds: number;
}): number {
  const liftTime = estimateLiftTimeSeconds(design);
  const shellEnd = liftTime + (design.launch.shell.visible ? 0.2 : 0);
  const liftParticles = design.launch.liftParticles;
  const liftParticleEnd =
    liftParticles.enabled && liftParticles.amount > 0
      ? liftTime * Math.min(1, Math.max(0, liftParticles.height / 100)) +
        (liftParticles.lifetime.baseSeconds + liftParticles.lifetime.afterglowSeconds) *
          (1 + Math.min(1, Math.max(0, liftParticles.lifetime.variationPercent / 100)))
      : 0;
  const smoke = design.launch.smoke;
  const smokeEnd = smoke.enabled && smoke.particles > 0 ? smoke.lifeSeconds : 0;

  return cueTimeSeconds + Math.max(shellEnd, liftParticleEnd, smokeEnd, 0.8) + 0.35;
}

export function estimateLaunchPreviewTicks({
  design,
  cueTimeSeconds,
  previewDuration,
}: {
  design: FireworkDesign;
  cueTimeSeconds: number;
  previewDuration: number;
}): EditorPreviewTick[] {
  const liftTime = estimateLiftTimeSeconds(design);
  const clampTick = (timeSeconds: number) => Math.min(previewDuration - 0.05, timeSeconds);

  return [
    { timeSeconds: clampTick(cueTimeSeconds), label: 'Launch' },
    { timeSeconds: clampTick(cueTimeSeconds + liftTime), label: 'Apex' },
    {
      timeSeconds: clampTick(estimateLaunchPreviewDurationSeconds({ design, cueTimeSeconds })),
      label: 'Trail clears',
    },
  ];
}

export function estimatePreviewTicks({
  design,
  cueTimeSeconds,
  previewDuration,
}: {
  design: FireworkDesign;
  cueTimeSeconds: number;
  previewDuration: number;
}): EditorPreviewTick[] {
  const timing = estimateFireworkDesignTiming(design);

  return [
    {
      timeSeconds: Math.min(previewDuration - 0.05, cueTimeSeconds + timing.effectStartSeconds),
      label: 'Burst',
    },
    {
      timeSeconds: Math.min(previewDuration - 0.05, cueTimeSeconds + timing.fadeStartSeconds),
      label: 'Fade starts',
    },
    {
      timeSeconds: Math.min(previewDuration - 0.05, cueTimeSeconds + timing.fadeFinishSeconds),
      label: 'Fade finishes',
    },
  ];
}
