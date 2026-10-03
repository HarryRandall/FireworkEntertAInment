/** Shared classifiers for Supabase client failures. */

// Existing classifier budget: inspect the root error and two nested causes.
const MAX_CAUSE_DEPTH = 2;

/** Classifies transient network failures from an unknown Supabase error and bounded causes. */
export function isSupabaseTransientNetworkError(error: unknown): boolean {
  if (!Boolean(error)) return false;

  const parts: string[] = [];
  const collect = (value: unknown, depth = 0) => {
    if (!Boolean(value) || depth > MAX_CAUSE_DEPTH) return;
    if (typeof value === 'string') {
      parts.push(value);
      return;
    }
    if (typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    for (const key of ['name', 'message', 'details', 'hint', 'code']) {
      const part = record[key];
      if (typeof part === 'string') parts.push(part);
    }
    collect(record.cause, depth + 1);
  };

  collect(error);
  const text = parts.join('\n');
  return /fetch failed|ETIMEDOUT|ENOTFOUND|ENETUNREACH|ECONNRESET|ECONNREFUSED|EAI_AGAIN|AbortError|TimeoutError|operation was aborted due to timeout/i.test(
    text,
  );
}
