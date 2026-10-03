/** Catalogue mutations validate external input and independently recheck editor authority. */
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireArea } from '@/lib/auth/server';
import { getServerClient } from '@/lib/supabase/server-client';

const actionInput = z
  .object({
    kind: z.enum(['effect', 'product']),
    id: z.string().uuid(),
    operation: z.enum(['duplicate', 'archive', 'publish']),
    versionId: z.string().uuid().nullable(),
  })
  .strict();
/** Expected user-facing errors stay separate from unexpected database or network failures. */
export type CatalogueActionResult =
  | { kind: 'success'; href?: string }
  | { kind: 'error'; message: string };
/** Runs an atomic catalogue RPC with editor-only rights and refreshes affected catalogue views. */
export async function catalogueAction(input: unknown): Promise<CatalogueActionResult> {
  const parsed = actionInput.safeParse(input);
  if (!parsed.success) return { kind: 'error', message: 'Invalid catalogue action.' };
  const identity = await requireArea('admin');
  if (!['super_admin', 'catalogue_editor'].includes(identity.access.staffRole ?? ''))
    return { kind: 'error', message: 'Catalogue editor access is required.' };
  const value = parsed.data;
  const client = await getServerClient();
  const result = await runMutation(client, value);
  if (result.error) {
    if (['23514', '23505', 'P0002', '22023', '42501'].includes(result.error.code))
      return { kind: 'error', message: result.error.message };
    throw new Error(result.error.message, { cause: result.error });
  }
  return refreshCatalogue(value, result.data);
}
function refreshCatalogue(
  value: z.infer<typeof actionInput>,
  data: unknown,
): CatalogueActionResult {
  for (const path of ['/admin/catalogue', '/admin/products', '/admin/multishots'])
    revalidatePath(path);
  const base = value.kind === 'effect' ? '/admin/catalogue' : '/admin/products';
  revalidatePath(`${base}/${value.id}`);
  return {
    kind: 'success',
    href:
      value.operation === 'duplicate' && typeof data === 'string' ? `${base}/${data}` : undefined,
  };
}
async function runMutation(
  client: Awaited<ReturnType<typeof getServerClient>>,
  value: z.infer<typeof actionInput>,
) {
  if (value.operation === 'duplicate')
    return client.rpc('duplicate_catalogue_item', { p_kind: value.kind, p_id: value.id });
  if (value.operation === 'archive')
    return value.kind === 'effect'
      ? client.rpc('archive_effect', { p_effect_id: value.id })
      : client.rpc('archive_product', { p_product_id: value.id });
  return publishMutation(client, value);
}
async function publishMutation(
  client: Awaited<ReturnType<typeof getServerClient>>,
  value: z.infer<typeof actionInput>,
) {
  if (value.versionId === null) {
    if (value.kind === 'product') return client.rpc('publish_pack', { p_pack_id: value.id });
    return {
      data: null,
      error: { code: '23514', message: 'A draft version is required to publish.' },
    };
  }
  // Match the version to its parent before accepting a client-supplied identifier.
  const version =
    value.kind === 'effect'
      ? await client
          .from('effect_versions')
          .select('id')
          .eq('id', value.versionId)
          .eq('effect_id', value.id)
          .eq('status', 'draft')
          .maybeSingle()
      : await client
          .from('product_versions')
          .select('id')
          .eq('id', value.versionId)
          .eq('product_id', value.id)
          .eq('status', 'draft')
          .maybeSingle();
  if (version.error) throw version.error;
  if (!version.data)
    return {
      data: null,
      error: { code: '23514', message: 'A matching draft version is required.' },
    };
  return value.kind === 'effect'
    ? client.rpc('publish_effect_version', { p_version_id: value.versionId })
    : client.rpc('publish_product_version', { p_version_id: value.versionId });
}
