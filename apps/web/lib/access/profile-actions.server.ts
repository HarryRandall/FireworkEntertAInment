'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { invalidateUserProfileCache } from '@/lib/access/current-profile.server';
import { getCurrentUserId } from '@/lib/auth/current-user.server';
import { createClient } from '@/lib/supabase/server';

const ProfileSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  themePreference: z.enum(['dark', 'light', 'system']).optional(),
});

type ProfilePatch = {
  fullName?: string;
  phone?: string;
  themePreference?: 'dark' | 'light' | 'system';
};

type SavedProfilePatch = {
  fullName: string | null;
  phone: string | null;
  themePreference: 'dark' | 'light' | 'system';
};

export async function updateProfileAction(
  input: ProfilePatch,
): Promise<{ ok: true; saved: SavedProfilePatch } | { ok: false; error: string }> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form details.' };
  }

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const patch: Record<string, string | null> = {};
  if ('fullName' in parsed.data) patch.full_name = parsed.data.fullName || null;
  if ('phone' in parsed.data) patch.phone = parsed.data.phone || null;
  if (parsed.data.themePreference) patch.theme_preference = parsed.data.themePreference;

  const supabase = createClient(await cookies());
  const result =
    Object.keys(patch).length > 0
      ? await supabase
          .from('users')
          .update(patch)
          .eq('id', userId)
          .select('full_name, phone, theme_preference')
          .maybeSingle()
      : await supabase
          .from('users')
          .select('full_name, phone, theme_preference')
          .eq('id', userId)
          .maybeSingle();
  if (result.error || !result.data) {
    console.error('[updateProfileAction] failed:', result.error);
    return { ok: false, error: 'Could not save changes' };
  }
  if (Object.keys(patch).length > 0) {
    await invalidateUserProfileCache(userId);
    revalidatePath('/settings/profile');
    revalidatePath('/home');
  }
  return {
    ok: true,
    saved: {
      fullName: result.data.full_name,
      phone: result.data.phone,
      themePreference: result.data.theme_preference as SavedProfilePatch['themePreference'],
    },
  };
}
