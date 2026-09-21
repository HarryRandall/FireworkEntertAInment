export const SHOW_TEMPLATES_BASE_SELECT =
  'id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, is_published, published_at, source_show_id, sort_order, created_at, updated_at';
export const SHOW_TEMPLATES_CORE_SELECT = SHOW_TEMPLATES_BASE_SELECT.replace(
  ', source_show_id',
  '',
);
export const SHOW_TEMPLATE_SUMMARIES_CORE_SELECT =
  'id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, composition_signature, time_of_day, mood_tags, is_featured, is_published, published_at, sort_order, created_at, updated_at';
export const SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT =
  'id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, is_published, published_at, sort_order, created_at, updated_at';

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' ? (error as { code?: string }).code : undefined;
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object'
    ? String((error as { message?: string | null }).message ?? '')
    : '';
}

export function isOptionalShowPresetSchemaError(error: unknown): boolean {
  const message = errorMessage(error);
  return Boolean(
    error &&
    (errorCode(error) === '42703' ||
      errorCode(error) === '42P01' ||
      errorCode(error) === 'PGRST200' ||
      errorCode(error) === 'PGRST204' ||
      message.includes('show_preset_like_counts') ||
      message.includes('source_show_id') ||
      message.includes('cover_shader') ||
      message.includes('cover_image_path')),
  );
}
