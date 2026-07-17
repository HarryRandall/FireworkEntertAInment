import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  isFireworkStyleDefaultKind,
  styleDefaultKindLabel,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';

export const ADMIN_EFFECTS_BASE_VIEW = 'base' as const;

export type AdminEffectsView = typeof ADMIN_EFFECTS_BASE_VIEW | FireworkStyleDefaultKind;

export const ADMIN_EFFECTS_VIEWS: readonly AdminEffectsView[] = [
  ADMIN_EFFECTS_BASE_VIEW,
  ...FIREWORK_STYLE_DEFAULT_KINDS,
];

export function isAdminEffectsView(view: string | null | undefined): view is AdminEffectsView {
  return view === ADMIN_EFFECTS_BASE_VIEW || isFireworkStyleDefaultKind(view);
}

export function parseAdminEffectsView(
  view: string | null | undefined,
  legacyTab?: string | null,
): AdminEffectsView {
  if (isAdminEffectsView(view)) return view;
  return legacyTab === 'defaults' ? 'star' : ADMIN_EFFECTS_BASE_VIEW;
}

export function adminEffectsViewLabel(view: AdminEffectsView): string {
  return view === ADMIN_EFFECTS_BASE_VIEW
    ? 'Base effects'
    : `${styleDefaultKindLabel(view)} defaults`;
}

export function adminEffectsViewHref(view: AdminEffectsView): string {
  return `/admin/effects?view=${view}`;
}

export function adminEffectsViewDescription(view: AdminEffectsView): string {
  if (view === ADMIN_EFFECTS_BASE_VIEW) {
    return 'Preview and edit the reusable firework patterns used to build catalogue fireworks.';
  }
  return `Preview and edit the saved ${styleDefaultKindLabel(view).toLowerCase()} settings applied in the renderer.`;
}
