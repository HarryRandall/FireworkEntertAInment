'use server';

/**
 * Dev firework lab server actions.
 *
 * The lab reads the colourless effect catalogue from
 * `lib/fireworks/effect-catalogue.ts` for instant previews, but saving writes
 * the edited `model_json` back to the live `public.firework_effects` row via
 * the existing admin `updateEffect` action. To build that save patch without
 * clobbering existing style-default links, the lab first loads the database
 * row (id, updated_at, metadata, current style-default assignments) by slug.
 */
import { getAdminEffectBySlug, requirePermission } from '@/lib/admin.server';
import type { AdminEffectDetail } from '@/lib/admin.types';

export type LabEffect = Pick<
  AdminEffectDetail,
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'patternKey'
  | 'sortOrder'
  | 'updatedAt'
  | 'starStyleDefaultId'
  | 'trailStyleDefaultId'
  | 'styleDefaultIds'
>;

export type LoadLabEffectResult = { ok: true; effect: LabEffect } | { ok: false; error: string };

/**
 * Load the live `firework_effects` row for a catalogue slug so the lab can
 * save the edited model back to that exact row. Returns a distinct error for
 * missing permissions versus a not-yet-seeded effect.
 */
export async function loadLabEffect(slug: string): Promise<LoadLabEffectResult> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) {
    return { ok: false, error: 'Sign in as a catalogue admin to load and save effects.' };
  }

  const effect = await getAdminEffectBySlug(slug);
  if (!effect) {
    return {
      ok: false,
      error: `${slug} is not in the database yet. Run the reseed migration first.`,
    };
  }

  return { ok: true, effect };
}
