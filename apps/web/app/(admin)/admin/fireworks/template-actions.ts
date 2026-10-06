'use server';
import { z } from 'zod';
import { effectTemplates, shotDuration } from '@showcrafter/renderer';
import { canonicaliseEffectModelJson, compileFireworkDesign } from '@showcrafter/fireworks/design';
import { requirePermission } from '@/lib/access/current-profile.server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { designJson, validateEditorDesign } from '@/lib/renderer-editor/validation';
import type { EditorDatabase } from '@/lib/renderer-editor/database';
import type { Json } from '@/lib/database.types';
import {
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  invalidateAdminCatalogueCache,
} from '@/lib/admin/cache-keys';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows/cache-keys';
const Input = z.object({
  name: z.string().trim().min(1).max(180),
  templateKey: z.string().min(1).max(80),
});
type Result = { ok: true; id: string } | { ok: false; error: string };
/** Creates a template firework and listed catalogue row in one permission-checked transaction. */
export async function createFireworkFromTemplate(input: z.infer<typeof Input>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue')))
    return { ok: false, error: 'Not permitted.' };
  const parsed = Input.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const template = effectTemplates.find((item) => item.key === parsed.data.templateKey);
  if (!template) return { ok: false, error: 'That template could not be found.' };
  const design = validateEditorDesign(template.design);
  if (!design.ok) return design;
  // The old engine has no exact conversion for these designs. A complete legacy
  // sphere is stored once for scheduling compatibility, independently of editor changes.
  const model = canonicaliseEffectModelJson({
    geometry: 'sphere',
    trailProfile: 'none',
    renderDefaults: { geometry: 'sphere' },
  });
  const snapshot = compileFireworkDesign({ baseModel: model });
  const client = createClient<EditorDatabase>(await cookies());
  const { data, error } = await client.rpc('create_firework_from_template', {
    p_template_key: template.key,
    p_name: parsed.data.name,
    p_design: designJson(design.value),
    p_model: JSON.parse(JSON.stringify(model)) as Json,
    p_render_snapshot: JSON.parse(JSON.stringify(snapshot)) as Json,
    p_duration_seconds: shotDuration(design.value),
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not confirm the created firework.' };
  await Promise.all([
    invalidateAdminEffectsCache(),
    invalidateAdminFireworksCache(),
    invalidateAdminCatalogueCache(),
    invalidateFireworkCatalogueCaches(),
  ]);
  for (const path of ['/admin/effects', '/admin/fireworks', '/admin/catalogue'])
    revalidatePath(path);
  return { ok: true, id: data };
}
