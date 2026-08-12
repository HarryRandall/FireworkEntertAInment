export function resolveReplayScrubCommit(params: {
  pendingTimeSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
}): { timeSeconds: number; continuePlaying: boolean } {
  return {
    timeSeconds: Math.max(0, Math.min(params.durationSeconds, params.pendingTimeSeconds)),
    continuePlaying: params.isPlaying,
  };
}

export type ReplayAudioTransport = {
  currentTime: number;
  play: () => Promise<void>;
};

export async function requestSoundtrackPlayback(params: {
  audio: ReplayAudioTransport;
  targetTimeSeconds: number;
  driftToleranceSeconds?: number;
}): Promise<{ status: 'started' } | { status: 'rejected'; error: unknown }> {
  const tolerance = params.driftToleranceSeconds ?? 0.25;
  if (Math.abs(params.audio.currentTime - params.targetTimeSeconds) > tolerance) {
    params.audio.currentTime = params.targetTimeSeconds;
  }

  try {
    // This call happens before the first await, preserving browser media
    // activation when the helper is invoked directly from a user interaction.
    await params.audio.play();
    return { status: 'started' };
  } catch (error) {
    return { status: 'rejected', error };
  }
}

export function resolveReplayRestart(isPlaying: boolean): {
  continuePlaying: boolean;
  startAfterSeek: boolean;
} {
  return isPlaying
    ? { continuePlaying: true, startAfterSeek: false }
    : { continuePlaying: false, startAfterSeek: true };
}
