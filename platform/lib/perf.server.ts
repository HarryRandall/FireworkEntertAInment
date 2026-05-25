/**
 * Lightweight server-side performance logger.
 *
 * In development, any task wrapped with {@link measureServerTask} that takes
 * longer than `SHOWCRAFTER_SLOW_LOG_MS` (default 500ms) prints a `[perf]`
 * line. Production is silent — Vercel timing already captures this.
 */
import 'server-only';

const SLOW_MS = Number(process.env.SHOWCRAFTER_SLOW_LOG_MS ?? 500);

/**
 * Runs `task` and logs its duration in dev when it exceeds the slow threshold.
 *
 * @param label Short identifier shown in the log line.
 * @param task  The async work to measure. The original return value is forwarded.
 */
export async function measureServerTask<T>(label: string, task: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    return await task();
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    if (process.env.NODE_ENV === 'development' && durationMs >= SLOW_MS) {
      console.info(`[perf] ${label} ${durationMs}ms`);
    }
  }
}
