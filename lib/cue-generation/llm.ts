/**
 * Provider-agnostic helpers for handling LLM responses.
 *
 * Different OpenRouter providers shape their errors and outputs slightly
 * differently — this module hides those wrinkles so the runner can stay
 * focused on the orchestration logic.
 */

/**
 * Best-effort extraction of a human-readable error string from an arbitrary
 * provider error object. Returns `null` when nothing useful is available;
 * callers should fall back to `error.message`.
 */
export function extractProviderError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const anyErr = error as {
    error?: { message?: unknown; metadata?: { raw?: unknown } };
    response?: { data?: unknown };
  };
  const fromError = anyErr.error?.message;
  if (typeof fromError === 'string' && fromError) return fromError;
  const rawMeta = anyErr.error?.metadata?.raw;
  if (typeof rawMeta === 'string' && rawMeta) return rawMeta.slice(0, 400);
  const data = anyErr.response?.data;
  if (typeof data === 'string' && data) return data.slice(0, 400);
  if (data && typeof data === 'object') {
    try {
      return JSON.stringify(data).slice(0, 400);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Strip a ```json ... ``` markdown fence if the model wrapped its JSON in one.
 * Some providers do this even when asked for raw JSON.
 */
export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}
