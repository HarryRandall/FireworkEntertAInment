import type { FireworkDesign } from '@/lib/fireworks/design';
import type { EditorPreviewTick } from './FireworkEditorShell';

function rangeMax(range: [number, number]) {
  return Math.max(range[0], range[1]);
}

function rangeMin(range: [number, number]) {
  return Math.min(range[0], range[1]);
}

function lifeScaleForGeometry(geometry: FireworkDesign['geometry']): { min: number; max: number } {
  switch (geometry) {
    case 'weeping':
    case 'falling_tail':
    case 'waterfall':
      return { min: 1.25, max: 1.6 };
    case 'pearls':
      return { min: 0.62, max: 0.62 };
    case 'ring':
      return { min: 0.82, max: 0.82 };
    default:
      return { min: 1, max: 1 };
  }
}

function closingFadePercent(layer: FireworkDesign['stars']['outer']) {
  const { closing } = layer.head;
  const fadePercents = [
    closing.colour.enabled ? closing.colour.fadePercent : null,
    closing.size.enabled ? closing.size.shrinkPercent : null,
    // The renderer holds head brightness until roughly the last 18% of life.
    18,
  ].filter((value): value is number => value != null);

  return Math.max(...fadePercents);
}

function estimateLiftTimeSeconds(design: FireworkDesign) {
  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  const dragK = 0.5 * 0.47 * 1.22 * (Math.PI / 10000);
  const shellMass = 0.5;
  const dt = 1 / 60;
  let vy = liftVelocity * 0.96;
  let liftTime = 0;

  while (vy > 0 && liftTime < design.shellLife) {
    vy += ((-dragK * vy * Math.abs(vy)) / shellMass) * dt;
    vy += -9.82 * dt;
    liftTime += dt;
  }

  return liftTime;
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
  const liftTime = estimateLiftTimeSeconds(design);
  const activeLayers = [design.stars.outer, design.stars.core].filter((layer) => layer.enabled);
  const layers = activeLayers.length > 0 ? activeLayers : [design.stars.outer];
  const burstTime = cueTimeSeconds + liftTime;
  const lifeScale = lifeScaleForGeometry(design.geometry);
  const fadeStartTime =
    burstTime +
    Math.min(
      ...layers.map((layer) => {
        const shortestLife = rangeMin(layer.burst.life) * lifeScale.min;
        return shortestLife * (1 - closingFadePercent(layer) / 100);
      }),
    );
  const fadeFinishTime =
    burstTime + Math.max(...layers.map((layer) => rangeMax(layer.burst.life) * lifeScale.max));

  return [
    { timeSeconds: Math.min(previewDuration - 0.05, burstTime), label: 'Burst' },
    { timeSeconds: Math.min(previewDuration - 0.05, fadeStartTime), label: 'Fade starts' },
    { timeSeconds: Math.min(previewDuration - 0.05, fadeFinishTime), label: 'Fade finishes' },
  ];
}
