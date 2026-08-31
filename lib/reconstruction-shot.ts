import type { LaunchPosition } from '@/lib/fireworks/design';

export type ReconstructionShotMetadata = {
  panDegrees: number | null;
  tiltDegrees: number | null;
  positionOverride: LaunchPosition | null;
  launchPositionIndex: number | null;
  seedOverride: number | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseShotPositionOverride(input: unknown): LaunchPosition | null {
  const root = record(input);
  if (!root) return null;
  const position = record(root.position) ?? root;
  const x = finiteNumber(position.x);
  const y = finiteNumber(position.y);
  const z = finiteNumber(position.z);
  if (x == null || y == null || z == null || [x, y, z].some((value) => Math.abs(value) > 1_000)) {
    return null;
  }
  return { x, y, z };
}

export function parseShotLaunchPositionIndex(input: unknown): number | null {
  const value = finiteNumber(record(input)?.launchPositionIndex);
  return value != null && Number.isInteger(value) && value >= 0 && value <= 2 ? value : null;
}

export function parseShotSeedOverride(input: unknown): number | null {
  const inputRecord = record(input);
  const value = finiteNumber(inputRecord?.seedOverride ?? inputRecord?.seed);
  return value != null && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647
    ? value
    : null;
}

function parseBoundedAngle(value: unknown, minimum: number, maximum: number): number | null {
  const angle = finiteNumber(value);
  return angle != null && angle >= minimum && angle <= maximum ? angle : null;
}

/** Read the launch contract sealed under `fireworks.variant_json.reconstructionShot`. */
export function parseReconstructionShotVariant(input: unknown): ReconstructionShotMetadata | null {
  const shot = record(record(input)?.reconstructionShot);
  if (!shot) return null;
  return {
    panDegrees: parseBoundedAngle(shot.panDegrees, -30, 30),
    tiltDegrees: parseBoundedAngle(shot.tiltDegrees, -50, 50),
    positionOverride: parseShotPositionOverride(shot),
    launchPositionIndex: parseShotLaunchPositionIndex(shot),
    seedOverride: parseShotSeedOverride(shot),
  };
}
