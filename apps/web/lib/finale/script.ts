/** Finale script clocks are elapsed firing times, independent of wall-clock time. */
import { writeCsv } from './csv.ts';
const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.
const SECONDS_PER_MINUTE = 60; // Clock radix, seconds.
const MINUTES_PER_HOUR = 60; // Clock radix, minutes.
const MILLISECOND_DIGITS = 3; // Finale's HH:MM:SS.mmm fractional width.
/** One firing event; timeMs is non-negative elapsed milliseconds from show start. */
export interface FinaleCue {
  timeMs: number;
  partNumber: string;
  description: string;
  position: string;
  angleDeg: number;
}
/** Formats non-negative elapsed milliseconds, rounding once before carrying into hours. */
export function finaleTime(timeMs: number): string {
  if (!Number.isFinite(timeMs) || timeMs < 0 || !Number.isSafeInteger(Math.round(timeMs)))
    throw new Error('A finite, non-negative firing time is required.');
  const milliseconds = Math.round(timeMs);
  const seconds = Math.floor(milliseconds / MILLISECONDS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const pair = (value: number) => String(value).padStart(2, '0');
  return `${pair(hours)}:${pair(minutes % MINUTES_PER_HOUR)}:${pair(seconds % SECONDS_PER_MINUTE)}.${String(milliseconds % MILLISECONDS_PER_SECOND).padStart(MILLISECOND_DIGITS, '0')}`;
}
/** Exports show firing events in stable time order; angles round to whole degrees, negative left. */
export function exportShowScript(cues: readonly FinaleCue[]): string {
  const sorted = [...cues].sort((left, right) => left.timeMs - right.timeMs);
  return writeCsv([
    ['eventTime', 'partNumber', 'description', 'position', 'angle'],
    ...sorted.map((cue) => {
      if (!Number.isFinite(cue.angleDeg)) throw new Error('A finite firing angle is required.');
      return [
        finaleTime(cue.timeMs),
        cue.partNumber,
        cue.description,
        cue.position,
        Math.round(cue.angleDeg),
      ];
    }),
  ]);
}
