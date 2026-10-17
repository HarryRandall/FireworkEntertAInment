/**
 * Copy for the generating-show splash. These helpers are pure so the wording
 * rules (no countdown, honest delay notes) can be tested without rendering.
 */

export type GenerationPhase = 'analysing' | 'generating' | 'finalising';

export function generationDelayLabel(
  phase: GenerationPhase,
  elapsedSeconds: number,
  estimateSeconds: number,
): string | null {
  if (elapsedSeconds < Math.max(estimateSeconds * 1.5, 60)) return null;
  if (phase === 'analysing' && elapsedSeconds >= 300)
    return 'Analysis delayed. Contact an admin if it does not finish.';
  return phase === 'analysing'
    ? 'Your track is taking longer than expected.'
    : phase === 'finalising'
      ? 'The preview is taking longer than expected.'
      : 'Your show is taking longer than expected.';
}

/**
 * Typical phase length in seconds. This is never shown as a countdown; it
 * only decides when the "taking longer than expected" note should appear.
 */
function phaseEstimateSeconds(phase: GenerationPhase, isWarm: boolean): number {
  if (phase === 'analysing') return isWarm ? 35 : 110;
  if (phase === 'finalising') return 5;
  return isWarm ? 18 : 45;
}

/** Wall-clock elapsed time as m:ss, so the user can see the run is alive. */
export function formatElapsed(seconds: number): string {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** Honest context for the active step: what is true now, never a countdown. */
export function stageStatusNote(params: {
  phase: GenerationPhase;
  hasAudio: boolean;
  isWarm: boolean;
  phaseElapsedSeconds: number;
}): string {
  const delayed = generationDelayLabel(
    params.phase,
    params.phaseElapsedSeconds,
    phaseEstimateSeconds(params.phase, params.isWarm),
  );
  if (delayed) return delayed;
  if (params.phase === 'analysing' && !params.isWarm) {
    return 'The analyser is starting up, so this first step can take a few minutes.';
  }
  if (params.phase === 'analysing') return 'This is usually the longest step.';
  if (params.phase === 'finalising') return 'Nearly there.';
  return params.hasAudio
    ? 'The track is analysed; the cues are being written now.'
    : 'The cues are being written now.';
}
