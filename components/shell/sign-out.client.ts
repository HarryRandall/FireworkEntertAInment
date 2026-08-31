'use client';

import { createClient } from '@/utils/supabase/client';

export type SignOutResult = { ok: true } | { ok: false; error: string };

/** Clear the browser session only after Supabase confirms the sign-out. */
export async function signOutCurrentSession(): Promise<SignOutResult> {
  try {
    const { error } = await createClient().auth.signOut();
    if (error) {
      console.error('[sign-out] Supabase rejected sign-out:', error);
      return { ok: false, error: 'Could not sign out. Check your connection and try again.' };
    }
    return { ok: true };
  } catch (error) {
    console.error('[sign-out] sign-out request failed:', error);
    return { ok: false, error: 'Could not sign out. Check your connection and try again.' };
  }
}
