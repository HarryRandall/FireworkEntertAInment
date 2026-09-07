export function shouldKeepPlannedMoment(params: {
  requestedTubeCount: number;
  acceptedTubeCount: number;
  vibe: string;
  nearClimax: boolean;
  finale: boolean;
}): boolean {
  const { requestedTubeCount, acceptedTubeCount, vibe, nearClimax, finale } = params;
  if (acceptedTubeCount === 0) return false;
  const coordinated =
    requestedTubeCount > 1 && (vibe === 'chorus' || vibe === 'drop' || nearClimax || finale);
  return !coordinated || acceptedTubeCount === requestedTubeCount;
}
