/** Shared classifiers for Supabase client failures. */

export function isSupabaseTransientNetworkError(error: unknown): boolean {
  if (!error) return false;

  const parts: string[] = [];
  const collect = (value: unknown, depth = 0) => {
    if (!value || depth > 2) return;
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
