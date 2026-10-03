/** Studio lifecycle actions validate exact persisted snapshots at the server boundary. */
'use server';
import { designSchema, RENDERER_VERSION } from '@showcrafter/fireworks';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireArea } from '@/lib/auth/server';
import { getServerClient } from '@/lib/supabase/server-client';
import { measureParticlePeak } from './checks';

const NOTE_LIMIT_CHARACTERS = 4000; // Review-note character budget, matching catalogue text entry.
const lifecycleInput = z
  .object({
    effectId: z.string().uuid(),
    versionId: z.string().uuid(),
    document: designSchema,
    note: z.string().trim().max(NOTE_LIMIT_CHARACTERS),
    operation: z.enum(['publish', 'review']),
  })
  .strict();
const restoreInput = z
  .object({
    effectId: z.string().uuid(),
    versionId: z.string().uuid(),
    currentVersionId: z.string().uuid(),
    document: designSchema,
  })
  .strict();
/** Refusals leave the current draft intact; unexpected failures reject the action promise. */
export type LifecycleResult =
  | { kind: 'success'; versionId: string }
  | { kind: 'error'; message: string };
async function editorClient() {
  const identity = await requireArea('admin');
  if (!['super_admin', 'catalogue_editor'].includes(identity.access.staffRole ?? '')) return null;
  return getServerClient();
}
function refusal(error: { code: string; message: string }): LifecycleResult {
  if (['23514', '23505', 'P0002', '22023', '42501'].includes(error.code))
    return { kind: 'error', message: error.message };
  throw new Error(error.message, { cause: error });
}
function refresh(effectId: string) {
  for (const path of [`/admin/catalogue/${effectId}`, '/admin/catalogue', '/admin/posters'])
    revalidatePath(path);
}
/** Publishes or submits only a saved matching draft, retaining the user's change note. */
export async function finishStudio(input: unknown): Promise<LifecycleResult> {
  const parsed = lifecycleInput.safeParse(input);
  if (!parsed.success) return { kind: 'error', message: 'Invalid review request.' };
  const client = await editorClient();
  if (!client) return { kind: 'error', message: 'Catalogue editor access is required.' };
  const value = parsed.data;
  const version = await client
    .from('effect_versions')
    .select('id,design,reference_media_id,checks')
    .eq('id', value.versionId)
    .eq('effect_id', value.effectId)
    .eq('status', 'draft')
    .maybeSingle();
  if (version.error) throw version.error;
  if (!version.data) return { kind: 'error', message: 'A matching current draft is required.' };
  const peak = value.operation === 'publish' ? measureParticlePeak(value.document) : null;
  if (peak !== null && peak.exceeded)
    return { kind: 'error', message: 'Publishing blocked: over the particle budget.' };
  const result = await client.rpc('finish_effect_version', {
    p_version_id: value.versionId,
    p_design: value.document,
    p_note: value.note,
    p_operation: value.operation,
    ...(peak === null ? {} : { p_peak: peak.count, p_peak_time_s: peak.timeS }),
  });
  if (result.error) return refusal(result.error);
  refresh(value.effectId);
  return { kind: 'success', versionId: value.versionId };
}
/** Restores a same-effect saved snapshot after independently checking editor access. */
export async function restoreStudio(input: unknown): Promise<LifecycleResult> {
  const parsed = restoreInput.safeParse(input);
  if (!parsed.success) return { kind: 'error', message: 'Invalid restoration request.' };
  const client = await editorClient();
  if (!client) return { kind: 'error', message: 'Catalogue editor access is required.' };
  const value = parsed.data;
  const result = await client.rpc('restore_effect_version', {
    p_effect_id: value.effectId,
    p_version_id: value.versionId,
    p_current_version_id: value.currentVersionId,
    p_design: value.document,
    p_renderer: RENDERER_VERSION,
  });
  if (result.error) return refusal(result.error);
  refresh(value.effectId);
  return { kind: 'success', versionId: result.data };
}
