/** Invitation writes remain inside the database acceptance fence. */
'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getServerClient } from '@/lib/supabase/server-client';
export type InvitationResult = { error: string };
/** Validates the token and delegates identity, expiry and membership checks to the RPC. */
export async function acceptInvitation(
  _previous: InvitationResult,
  form: FormData,
): Promise<InvitationResult> {
  const token = z.string().min(1).safeParse(form.get('token'));
  if (!token.success) return { error: 'This invitation link is incomplete.' };
  const client = await getServerClient();
  const { error } = await client.rpc('accept_invitation', { p_token: token.data });
  if (error) {
    if (error.code === '42501' || error.code === '22023')
      return {
        error:
          'This invitation is unavailable, or your verified email does not match. Ask the retailer for a new invitation.',
      };
    throw error;
  }
  redirect('/retailer');
}
