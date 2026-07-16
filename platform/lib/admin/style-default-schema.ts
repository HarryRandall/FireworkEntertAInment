type SupabaseErrorLike = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

const MISSING_STYLE_DEFAULT_SCHEMA_CODES = new Set(['42P01', '42703', 'PGRST200', 'PGRST204']);
const MISSING_EDITOR_VERSION_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const MISSING_EDITOR_VERSION_COLUMN_CODES = new Set(['42703', 'PGRST204']);

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
    text.includes('firework_style_defaults') &&
    (text.includes('schema cache') ||
      text.includes('could not find') ||
      text.includes('does not exist') ||
      text.includes('relationship'))
  );
}

export function isMissingEditorVersionTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const supabaseError = error as SupabaseErrorLike;
  const text = errorText(error).toLowerCase();
  return (
    Boolean(supabaseError.code && MISSING_EDITOR_VERSION_TABLE_CODES.has(supabaseError.code)) &&
    text.includes('firework_editor_versions') &&
    (text.includes('schema cache') ||
      text.includes('could not find') ||
      text.includes('does not exist'))
  );
}

export function isMissingStyleDefaultEditorVersionColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const supabaseError = error as SupabaseErrorLike;
  if (!supabaseError.code || !MISSING_EDITOR_VERSION_COLUMN_CODES.has(supabaseError.code)) {
    return false;
  }
  return errorText(error).toLowerCase().includes('firework_style_default_id');
}

export function isMissingEditorVersionSchemaError(error: unknown): boolean {
  return (
    isMissingEditorVersionTableError(error) || isMissingStyleDefaultEditorVersionColumnError(error)
  );
}
