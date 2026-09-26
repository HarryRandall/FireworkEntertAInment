import type { FireworkDesign, LaunchPosition } from './design.ts';

/** The renderer consumes resolved visuals, not database or application models. */
export type RendererCue = {
  id: string;
  timeSeconds: number;
  launchPositionIndex: number;
  seedOverride?: number | null;
  emphasis?: 'normal' | 'accent' | 'peak';
  shotPanDegrees?: number | null;
  shotTiltDegrees?: number | null;
  shotPositionOverride?: LaunchPosition | null;
  firework: {
    id: string;
    caliber: string | null;
    durationSeconds: number | null;
    renderDesign: FireworkDesign | null;
  };
};
