/** Cookie-bound account reads preserve ownership and unexpected database failures. */
import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { accountSchema } from './contracts';
/** Reads the active caller's lists, shows, history, consent and request status. */
export async function readAccount() {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('shopper_account');
  if (error) throw error;
  return accountSchema.parse(data);
}
