type SupabaseErrorLike = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

const MISSING_STYLE_DEFAULT_SCHEMA_CODES = new Set(['42P01', '42703', 'PGRST200', 'PGRST204']);

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

export function isMissingStyleDefaultSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const supabaseError = error as SupabaseErrorLike;
  if (supabaseError.code && MISSING_STYLE_DEFAULT_SCHEMA_CODES.has(supabaseError.code)) {
    return true;
  }

  const text = errorText(error).toLowerCase();
  return (
    (text.includes('firework_style_defaults') ||
      text.includes('firework_effect_style_default_links') ||
      text.includes('firework_style_default_links') ||
      text.includes('star_style_default_id') ||
      text.includes('trail_style_default_id')) &&
    (text.includes('schema cache') ||
      text.includes('could not find') ||
      text.includes('does not exist') ||
      text.includes('relationship'))
  );
}
