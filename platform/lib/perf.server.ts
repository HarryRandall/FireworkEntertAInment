import "server-only";

const SLOW_MS = Number(process.env.SHOWCRAFTER_SLOW_LOG_MS ?? 500);

export async function measureServerTask<T>(
  label: string,
  task: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await task();
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    if (process.env.NODE_ENV === "development" && durationMs >= SLOW_MS) {
      console.info(`[perf] ${label} ${durationMs}ms`);
    }
  }
}
