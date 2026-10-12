type SupabaseErrorLike = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const supabaseError = error as SupabaseErrorLike;
  return [supabaseError.code, supabaseError.message, supabaseError.details, supabaseError.hint]
    .filter(Boolean)
    .join(' ');
}

export function describeSupabaseError(error: unknown): string {
  const text = errorText(error);
  return text || 'Unknown Supabase error';
}
