/** Validated shopper writes use caller RLS or transactional ownership-fenced RPCs. */
'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CONSENT_VERSION, MAX_LIST_QUANTITY, type ListResult } from './contracts';
// Display-name character limit is a product choice for readable account headings.
const MAX_DISPLAY_NAME_LENGTH = 100;
const uuid = z.string().uuid();
function result(error: { code: string; message: string } | null): ListResult {
  if (error?.code === '23514') return { status: 'invalid', message: error.message };
  if (error) {
    console.error('Shopper list write failed', { code: error.code, message: error.message });
    throw new Error(error.message);
  }
  revalidatePath('/account', 'layout');
  revalidatePath('/shopper/stores', 'layout');
  return { status: 'ok' };
}
/** Adds a visible product or the exact displayed plan revision with an idempotent request UUID. */
export async function addToList(raw: unknown): Promise<ListResult> {
  const request = z
    .object({
      store: uuid,
      request: uuid,
      product: uuid.optional(),
      candidate: uuid.optional(),
      revision: z.number().int().nonnegative().optional(),
    })
    .strict()
    .safeParse(raw);
  if (!request.success)
    return { status: 'invalid', message: 'Please reload before adding to your list.' };
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('add_shopper_list', {
    p_store: request.data.store,
    p_request: request.data.request,
    p_product: request.data.product,
    p_candidate: request.data.candidate,
    p_revision: request.data.revision,
  });
  const outcome = result(error);
  return outcome.status === 'ok' && data !== null ? { status: 'ok', id: data } : outcome;
}
/** Changes an existing list quantity, preserving its price; zero removes the product. */
export async function setQuantity(raw: unknown): Promise<ListResult> {
  const request = z
    .object({ list: uuid, product: uuid, quantity: z.number().int().min(0).max(MAX_LIST_QUANTITY) })
    .strict()
    .safeParse(raw);
  if (!request.success) return { status: 'invalid', message: 'Enter a valid whole quantity.' };
  const client = createClient(await cookies());
  const { error } = await client.rpc('set_list_quantity', {
    p_list: request.data.list,
    p_product: request.data.product,
    p_quantity: request.data.quantity,
  });
  return result(error);
}
/** Stores independent explicit consent choices for one shop with the displayed text version. */
export async function saveConsent(raw: unknown): Promise<ListResult> {
  const request = z
    .object({ organisation: uuid, visible: z.boolean(), marketing: z.boolean() })
    .strict()
    .safeParse(raw);
  if (!request.success) return { status: 'invalid', message: 'Please check your shop choices.' };
  const client = createClient(await cookies());
  const { error } = await client.rpc('save_shopper_consent', {
    p_organisation: request.data.organisation,
    p_visible: request.data.visible,
    p_marketing: request.data.marketing,
    p_version: CONSENT_VERSION,
  });
  return result(error);
}
/** Records a pending export or deletion request without claiming it has been processed. */
export async function requestPrivacy(raw: unknown): Promise<ListResult> {
  const request = z.enum(['export', 'delete']).safeParse(raw);
  if (!request.success)
    return { status: 'invalid', message: 'Choose an export or delete request.' };
  const client = createClient(await cookies());
  const { data, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const existing = await client
    .from('privacy_requests')
    .select('id')
    .eq('shopper_id', data.user.id)
    .eq('kind', request.data)
    .eq('status', 'pending')
    .limit(1);
  if (existing.error) {
    console.error('Shopper privacy request read failed', {
      code: existing.error.code,
      message: existing.error.message,
    });
    throw existing.error;
  }
  if (existing.data.length > 0) return { status: 'ok' };
  const { error } = await client
    .from('privacy_requests')
    .insert({ shopper_id: data.user.id, kind: request.data });
  return result(error);
}
/** Updates the active caller's display name, leaving Auth identity fields provider-owned. */
export async function saveDisplayName(raw: unknown): Promise<ListResult> {
  const parsed = z.string().trim().max(MAX_DISPLAY_NAME_LENGTH).safeParse(raw);
  if (!parsed.success) return { status: 'invalid', message: 'Use a name up to 100 characters.' };
  const client = createClient(await cookies());
  const { data, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const { error } = await client
    .from('profiles')
    .update({ display_name: parsed.data })
    .eq('id', data.user.id);
  return result(error);
}
