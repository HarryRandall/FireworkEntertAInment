import 'server-only';

import { deleteCachedKeys } from '@/lib/server-cache';

const SHOW_TEMPLATE_CACHE_KEY = 'platform:v1:show-templates:database-v4';

export const SHOW_TEMPLATES_TTL_SECONDS = 60 * 10;

export function getShowTemplatesCacheKey(): string {
  return SHOW_TEMPLATE_CACHE_KEY;
}

/** Invalidate public summaries after a saved-state or admin preset mutation. */
export async function invalidateShowTemplatesCache(): Promise<void> {
  await deleteCachedKeys([getShowTemplatesCacheKey()]);
}
