export type LaunchPosition = { x: number; y: number; z: number };

export const DEFAULT_LAUNCH_POSITIONS: LaunchPosition[] = [
  { x: -200, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 200, y: 0, z: 0 },
];

export function parseLaunchPositions(input: unknown): LaunchPosition[] {
  if (!Array.isArray(input)) return DEFAULT_LAUNCH_POSITIONS;
  const positions = input
    .slice(0, 3)
    .map((entry): LaunchPosition | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const record = entry as Record<string, unknown>;
      const x = Number(record.x);
      const y = Number(record.y);
      const z = Number(record.z);
      if (![x, y, z].every(Number.isFinite)) return null;
      return { x, y, z };
    })
    .filter((position): position is LaunchPosition => position !== null);
  return positions.length > 0 ? positions : DEFAULT_LAUNCH_POSITIONS;
}
