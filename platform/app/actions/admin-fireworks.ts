'use server';

/** Admin firework actions: create and edit atomic fireworks (effect + colours
 *  + renderer overrides). Multishot composition lives in `admin-multishots`. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  invalidateAdminCatalogueCache,
  invalidateAdminFireworksCache,
  invalidateAdminMultishotsCache,
  requirePermission,
} from '@/lib/admin.server';
import type { Json } from '@/lib/database.types';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const HexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Colours must be 6-digit hex like #ff0043.')
  .transform((value) => value.toLowerCase());

const CreateFireworkSchema = z.object({
  name: z.string().trim().min(1).max(180),
  effectId: z.string().uuid(),
});

const UpdateFireworkSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  fireworkEffectId: z.string().uuid(),
  caliber: z.string().trim().max(40).optional().nullable(),
  durationSeconds: z.coerce.number().min(0).max(3600).optional().nullable(),
  heightMeters: z.coerce.number().min(0).max(400).optional().nullable(),
  primaryColor: HexColor.optional().nullable(),
  secondaryColor: HexColor.optional().nullable(),
  colorPalette: z.array(HexColor).max(12).optional(),
  renderOverridesJson: z.string().trim().min(2).max(100_000),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function parseJsonObject(text: string): { ok: true; value: Json } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Renderer overrides JSON is invalid.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Renderer overrides must be a JSON object.' };
  }
  return { ok: true, value: parsed as Json };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function refresh(fireworkId?: string) {
  await invalidateAdminFireworksCache(fireworkId);
  await invalidateAdminMultishotsCache();
  await invalidateAdminCatalogueCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/fireworks');
  if (fireworkId) revalidatePath(`/admin/fireworks/${fireworkId}`);
  revalidatePath('/admin/multishots');
  revalidatePath('/admin/catalogue');
}

/** Create a blank firework on a base effect; a catalogue row is auto-created. */
export async function createFirework(
  input: z.infer<typeof CreateFireworkSchema>,
): Promise<CreateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = CreateFireworkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const baseSlug = slugify(parsed.data.name) || 'firework';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from('fireworks')
    .insert({
      firework_effect_id: parsed.data.effectId,
      slug,
      name: parsed.data.name,
      render_overrides_json: {},
      color_palette: [],
      source: 'manual',
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not create firework.' };
  await refresh(data.id);
  return { ok: true, id: data.id };
}

/** Persist all firework-level fields, including colours and renderer overrides. */
export async function updateFirework(input: z.infer<typeof UpdateFireworkSchema>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = UpdateFireworkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const overrides = parseJsonObject(parsed.data.renderOverridesJson);
  if (!overrides.ok) return { ok: false, error: overrides.error };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('fireworks')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      firework_effect_id: parsed.data.fireworkEffectId,
      caliber: parsed.data.caliber || null,
      duration_seconds: parsed.data.durationSeconds ?? null,
      height_meters: parsed.data.heightMeters ?? null,
      primary_color: parsed.data.primaryColor || null,
      secondary_color: parsed.data.secondaryColor || null,
      color_palette: parsed.data.colorPalette ?? [],
      render_overrides_json: overrides.value,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id);

  if (error) return { ok: false, error: error.message };
  await refresh(parsed.data.id);
  return { ok: true };
}
