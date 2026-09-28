export function generationDelayLabel(
  phase: 'analysing' | 'generating' | 'finalising',
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
