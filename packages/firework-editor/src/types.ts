import type { FireworkDesign } from '@showcrafter/fireworks/design';
import type { ReactNode } from 'react';

export type JsonRecord = Record<string, unknown>;

export type RenderControlsProps = {
  part?: 'appearance' | 'colours' | 'movement' | 'trails' | 'flight';
  layer?: 'outer' | 'core';
  design: FireworkDesign;
  defaults: JsonRecord;
  /**
   * Saved base settings used as the 50% point for calibrated appearance sliders.
   * If absent, the controls fall back to their renderer-safe defaults.
   */
  calibrationDefaults?: JsonRecord;
  mutate: (updater: (defaults: JsonRecord) => void) => void;
  disabled?: boolean;
  /** Content to render directly after the required Burst section. */
  afterBurst?: ReactNode;
  /** Optional firework colour controls shown inside the primary Star section. */
  starControls?: ReactNode;
  /** Show the lift-particle and smoke launch-visual panels. Firework-level. */
  showLaunch?: boolean;
  /** Show the star / streak count controls. Firework-level. */
  showStarCount?: boolean;
  /** Limit the editor to one reusable style-default surface. */
  controlScope?:
    | 'full'
    | 'star'
    | 'starInner'
    | 'trail'
    | 'geometry'
    | 'launch'
    | 'launchShell'
    | 'launchTrail'
    | 'smoke'
    | 'strobe'
    | 'crackle'
    | 'split'
    | 'sound';
};
