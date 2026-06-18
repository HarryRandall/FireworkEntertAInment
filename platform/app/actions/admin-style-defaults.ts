'use server';

/** Admin actions for reusable live firework renderer style defaults. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  invalidateAdminStyleDefaultsCache,
  requirePermission,
} from '@/lib/admin.server';
import type { Json } from '@/lib/database.types';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  INITIAL_STYLE_DEFAULT_JSON,
  styleDefaultKindLabel,
} from '@/lib/fireworks/style-defaults';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type UpdateResult = { ok: true; updatedAt: string } | { ok: false; error: string };
type Result = { ok: true } | { ok: false; error: string };

const StyleDefaultKindSchema = z.enum(FIREWORK_STYLE_DEFAULT_KINDS);

const CreateStyleDefaultSchema = z.object({
  kind: StyleDefaultKindSchema,
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  defaultsJson: z.string().trim().min(2).max(100_000),
});

const UpdateStyleDefaultSchema = CreateStyleDefaultSchema.extend({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  isArchived: z.boolean(),
});

const ArchiveStyleDefaultSchema = z.object({
  id: z.string().uuid(),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function parseJsonObject(text: string): { ok: true; value: Json } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Default JSON is invalid.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Default JSON must be an object.' };
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

async function refresh(defaultId?: string) {
  await invalidateAdminStyleDefaultsCache(defaultId);
  await invalidateAdminEffectsCache();
  await invalidateAdminFireworksCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/effects');
  if (defaultId) revalidatePath(`/admin/effects/defaults/${defaultId}`);
  revalidatePath('/admin/fireworks');
}

export async function createStyleDefault(
  input: z.infer<typeof CreateStyleDefaultSchema>,
): Promise<CreateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = CreateStyleDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const defaults = parseJsonObject(parsed.data.defaultsJson);
  if (!defaults.ok) return { ok: false, error: defaults.error };

  const supabase = createClient(await cookies());
  const baseSlug = slugify(parsed.data.name) || `${parsed.data.kind}-style`;
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('firework_style_defaults')
    .insert({
      slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      defaults_json: defaults.value,
      sort_order: 9000,
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not create style default.' };

  await refresh(data.id);
  return { ok: true, id: data.id };
}

export async function createStyleDefaultFromKind(formData: FormData): Promise<void> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    redirect('/admin/effects?tab=defaults');
  }

  const kind = StyleDefaultKindSchema.safeParse(formData.get('kind'));
  const parsedKind = kind.success ? kind.data : 'star';
  const result = await createStyleDefault({
    kind: parsedKind,
    name: `New ${styleDefaultKindLabel(parsedKind).toLowerCase()} style`,
    description: '',
    defaultsJson: JSON.stringify(INITIAL_STYLE_DEFAULT_JSON[parsedKind], null, 2),
  });

  if (!result.ok) throw new Error(result.error);
  redirect(`/admin/effects/defaults/${result.id}`);
}

export async function updateStyleDefault(
  input: z.infer<typeof UpdateStyleDefaultSchema>,
): Promise<UpdateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = UpdateStyleDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const defaults = parseJsonObject(parsed.data.defaultsJson);
  if (!defaults.ok) return { ok: false, error: defaults.error };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('firework_style_defaults')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      defaults_json: defaults.value,
      sort_order: parsed.data.sortOrder,
      is_archived: parsed.data.isArchived,
    })
    .eq('id', parsed.data.id)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select('updated_at')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This style default changed in another session. Refresh before saving again.',
    };
  }

  await refresh(parsed.data.id);
  return { ok: true, updatedAt: data.updated_at };
}

export async function archiveStyleDefault(
  input: z.infer<typeof ArchiveStyleDefaultSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = ArchiveStyleDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('firework_style_defaults')
    .update({ is_archived: true })
    .eq('id', parsed.data.id);

  if (error) return { ok: false, error: error.message };
  await refresh(parsed.data.id);
  return { ok: true };
}
