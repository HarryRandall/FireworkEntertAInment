/** Multishot editor model: local shot shape, timeline constants and pure helpers. */
import type { AdminMultishotDetail } from '@/lib/admin.types';
import {
  clampMultishotPanDegrees,
  clampMultishotTiltDegrees,
  clampMultishotTrackIndex,
} from '@/lib/admin/multishot-constraints';
import { DEFAULT_LIFT_VELOCITY, type LaunchPosition } from '@showcrafter/fireworks/design';
import type { FireworkSpecification } from '@/lib/show-domain';

export const SINGLE_MORTAR: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];

export const PX_PER_SECOND = 96;

export const MIN_CLIP_PX = 46;

export const MIN_TIMELINE_TRACK_COUNT = 4;

export const TIMELINE_TRACK_HEIGHT_PX = 48;

export const TIMELINE_TRACK_LABEL_WIDTH_PX = 112;

export const TIMELINE_CLIP_INSET_PX = 5;

export const MIN_TIMELINE_SECONDS = 6;

export const DEFAULT_FIREWORK_DURATION = 2.4;

export const SAVE_DEBOUNCE_MS = 650;

export const SCRUB_COMMIT_MS = 60;

export const PREVIEW_TRANSPORT_IDLE_MS = 2000;

export const INSPECTOR_RAIL_WIDTH_PX = 340;

export const INSPECTOR_RAIL_GAP_PX = 20;

export const INSPECTOR_RENDER_OVERSCAN_PX = INSPECTOR_RAIL_WIDTH_PX + INSPECTOR_RAIL_GAP_PX;

export const PAN_PRESETS = [
  { value: -30, label: 'L 30°', title: 'Hard left pan' },
  { value: -15, label: 'L 15°', title: 'Soft left pan' },
  { value: 0, label: '0°', title: 'Straight up' },
  { value: 15, label: 'R 15°', title: 'Soft right pan' },
  { value: 30, label: 'R 30°', title: 'Hard right pan' },
];

export const TILT_PRESETS = [
  { value: -50, label: 'B 50°', title: 'Deep back tilt' },
  { value: -25, label: 'B 25°', title: 'Soft back tilt' },
  { value: 0, label: '0°', title: 'Level depth' },
  { value: 25, label: 'F 25°', title: 'Soft front tilt' },
  { value: 50, label: 'F 50°', title: 'Deep front tilt' },
];

export const SHOT_SELECTION_KEEP_SELECTOR = [
  '[data-preserve-shot-selection]',
  '[data-slot="select-content"]',
  '[data-slot="select-item"]',
].join(',');

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export type PersistShotOptions = {
  updateUi?: boolean;
};

export type LocalShot = {
  uid: string;
  id?: string;
  fireworkId: string;
  timelineTrackIndex: number;
  timeOffsetSeconds: number;
  panDegrees: number;
  tiltDegrees: number;
  sequenceIndex: number;
  caliber: string | null;
  notes: string;
  saveState: SaveState;
};

let uidCounter = 0;

export function makeUid(): string {
  uidCounter += 1;
  return `shot-${Date.now().toString(36)}-${uidCounter}`;
}

export function shouldKeepShotSelection(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(SHOT_SELECTION_KEEP_SELECTOR));
}

export function toLocalShot(shot: AdminMultishotDetail['shots'][number]): LocalShot {
  return {
    uid: makeUid(),
    id: shot.id,
    fireworkId: shot.fireworkId ?? '',
    timelineTrackIndex: clampMultishotTrackIndex(shot.timelineTrackIndex),
    timeOffsetSeconds: shot.timeOffsetSeconds,
    panDegrees: clampMultishotPanDegrees(shot.panDegrees),
    tiltDegrees: clampMultishotTiltDegrees(shot.tiltDegrees),
    sequenceIndex: shot.sequenceIndex,
    caliber: shot.caliber,
    notes: shot.notes ?? '',
    saveState: 'idle',
  };
}

export function shotPersistenceSignature(shot: LocalShot): string {
  return JSON.stringify([
    shot.fireworkId,
    shot.timelineTrackIndex,
    shot.timeOffsetSeconds,
    shot.panDegrees,
    shot.tiltDegrees,
    shot.sequenceIndex,
    shot.caliber,
    shot.notes,
  ]);
}

export function nextShotSequenceIndex(shots: LocalShot[]): number {
  return shots.length ? Math.max(...shots.map((shot) => shot.sequenceIndex)) + 1 : 1;
}

export function timelineTrackCount(shots: Array<Pick<LocalShot, 'timelineTrackIndex'>>): number {
  let highestTrackIndex = -1;
  for (const shot of shots)
    highestTrackIndex = Math.max(highestTrackIndex, shot.timelineTrackIndex);
  return Math.max(MIN_TIMELINE_TRACK_COUNT, highestTrackIndex + 1);
}

export function fireworkDurationOf(spec: FireworkSpecification | undefined): number {
  const d = spec?.durationSeconds;
  return d && Number.isFinite(d) && d > 0 ? d : DEFAULT_FIREWORK_DURATION;
}

export function colorOf(spec: FireworkSpecification | undefined): string {
  return clipPaletteOf(spec).primary;
}

export function clipPaletteOf(spec: FireworkSpecification | undefined): {
  primary: string;
  secondary: string;
} {
  const palette = spec?.variant?.colorPalette.filter(Boolean) ?? [];
  const primary = spec?.variant?.primaryColor ?? palette[0] ?? '#38bdf8';
  const secondary =
    spec?.variant?.secondaryColor ??
    palette.find((color) => color !== primary) ??
    (spec?.baseEffect?.patternKey.includes('chrysanthemum') ? '#22c55e' : '#a78bfa');
  return { primary, secondary };
}

export function fireworkPaletteOf(spec: FireworkSpecification | undefined): string[] {
  if (!spec) return [];
  return Array.from(
    new Set(
      [
        spec.variant?.primaryColor,
        spec.variant?.secondaryColor,
        ...(spec.variant?.colorPalette ?? []),
      ].filter((colour): colour is string => Boolean(colour)),
    ),
  ).slice(0, 5);
}

export function formatSecondsLabel(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

export function formatTimelineTimestamp(seconds: number): string {
  const totalTenths = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 10)) : 0;
  const minutes = Math.floor(totalTenths / 600);
  const secondsWithinMinute = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  const wholeSeconds = secondsWithinMinute.toString().padStart(2, '0');
  return `${minutes}:${wholeSeconds}.${tenths}`;
}

export const GUIDE_GRAVITY = -9.82;

export function burstCentre(
  spec: FireworkSpecification | undefined,
  panDegrees: number,
  tiltDegrees: number,
): { x: number; y: number; z: number } {
  const design = spec?.renderDesign;
  const liftVelocity = design?.liftVelocity ?? DEFAULT_LIFT_VELOCITY;
  const panR = (panDegrees * Math.PI) / 180;
  const tiltR = (tiltDegrees * Math.PI) / 180;
  const vx = Math.sin(panR) * Math.max(1.2, liftVelocity * 0.62);
  const vz = Math.sin(tiltR) * Math.max(1.0, liftVelocity * 0.42);
  const vy = liftVelocity * Math.max(0.82, Math.cos(panR) * 0.96);
  const apex = Math.max(0, vy / Math.abs(GUIDE_GRAVITY));
  return {
    x: vx * apex * 100,
    y: (vy * apex + 0.5 * GUIDE_GRAVITY * apex * apex) * 100,
    z: vz * apex * 100,
  };
}
