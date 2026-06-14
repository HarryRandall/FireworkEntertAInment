export const featuredTemplateDismissalCookieName = 'showcrafter_featured_template_dismissed_until';
export const featuredTemplateDismissalCookieMaxAge = 60 * 60 * 24;
export const featuredTemplateDismissalDurationMs = featuredTemplateDismissalCookieMaxAge * 1000;

export function parseFeaturedTemplateDismissedUntil(
  value: string | null | undefined,
  now = Date.now(),
) {
  if (!value) return null;

  const dismissedUntil = Number(value);
  if (!Number.isFinite(dismissedUntil) || dismissedUntil <= now) return null;

  return dismissedUntil;
}
