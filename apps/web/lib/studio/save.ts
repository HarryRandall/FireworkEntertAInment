/** Server writes use existing transactional catalogue RPCs and independent editor authority. */
'use server';
import { z } from 'zod';
import { designSchema, RENDERER_VERSION } from '@showcrafter/fireworks';
import { revalidatePath } from 'next/cache';
import { requireArea } from '@/lib/auth/server';
import { getServerClient } from '@/lib/supabase/server-client';

const saveInput = z
  .object({
    effectId: z.string().uuid(),
    versionId: z.string().uuid().nullable(),
    sourceVersionId: z.string().uuid(),
    document: designSchema,
  })
  .strict();
/** Expected catalogue refusals retain the browser draft and invite a retry or reload. */
export type SaveResult = { kind: 'saved'; versionId: string } | { kind: 'error'; message: string };
/** Validates a v1 document and saves only its parent's open draft, preserving published history. */
export async function saveStudio(input: unknown): Promise<SaveResult> {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success)
    return { kind: 'error', message: 'The draft is not a valid firework design.' };
  const identity = await requireArea('admin');
  if (!['super_admin', 'catalogue_editor'].includes(identity.access.staffRole ?? ''))
    return { kind: 'error', message: 'Catalogue editor access is required.' };
  const client = await getServerClient();
  const value = parsed.data;
  const effect = await client
    .from('effects')
    .select('id,slug,name,family,status,draft_version_id,current_version_id')
    .eq('id', value.effectId)
    .single();
  if (effect.error) throw effect.error;
  if (effect.data.status === 'archived')
    return { kind: 'error', message: 'Archived fireworks cannot be edited.' };
  if (effect.data.draft_version_id !== value.versionId)
    return { kind: 'error', message: 'The open draft has changed. Reload before editing it.' };
  const result =
    value.versionId === null
      ? await createDraft(client, effect.data, value)
      : await saveDraft(client, value);
  if (result.kind === 'saved') {
    revalidatePath(`/admin/catalogue/${value.effectId}`);
    revalidatePath('/admin/catalogue');
  }
  return result;
}
type SaveInput = z.infer<typeof saveInput>;
type Client = Awaited<ReturnType<typeof getServerClient>>;
async function createDraft(
  client: Client,
  effect: {
    id: string;
    slug: string;
    name: string;
    family: string;
    current_version_id: string | null;
  },
  value: SaveInput,
): Promise<SaveResult> {
  if (effect.current_version_id !== value.sourceVersionId)
    return {
      kind: 'error',
      message: 'The published version has changed. Reload before editing it.',
    };
  const result = await client.rpc('create_effect_draft', {
    p_effect_id: effect.id,
    p_slug: effect.slug,
    p_name: effect.name,
    p_family: effect.family,
    p_design: value.document,
    p_renderer: RENDERER_VERSION,
    p_parent_version_id: value.sourceVersionId,
  });
  if (result.error) return databaseRefusal(result.error);
  if (result.data === '') throw new Error('Draft creation returned no version.');
  return { kind: 'saved', versionId: result.data };
}
async function saveDraft(client: Client, value: SaveInput): Promise<SaveResult> {
  if (value.versionId === null) throw new Error('An open draft is required.');
  // Preserve review metadata: the save RPC replaces these fields as well as the document.
  const version = await client
    .from('effect_versions')
    .select('change_note,checks,reference_media_id')
    .eq('id', value.versionId)
    .eq('effect_id', value.effectId)
    .eq('status', 'draft')
    .single();
  if (version.error) return databaseRefusal(version.error);
  const result = await client.rpc('save_effect_draft', {
    p_version_id: value.versionId,
    p_design: value.document,
    p_renderer: RENDERER_VERSION,
    p_change_note: version.data.change_note ?? undefined,
    p_checks: version.data.checks,
    p_reference_media_id: version.data.reference_media_id ?? undefined,
  });
  if (result.error) return databaseRefusal(result.error);
  return { kind: 'saved', versionId: value.versionId };
}
function databaseRefusal(error: { code: string; message: string }): SaveResult {
  if (['23514', '23505', 'P0002', '22023', '42501', 'PGRST116'].includes(error.code))
    return { kind: 'error', message: error.message };
  console.error('Unexpected Studio draft database failure', {
    code: error.code,
    message: error.message,
  });
  throw new Error(error.message, { cause: error });
}
