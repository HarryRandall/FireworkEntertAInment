'use server';

/** Authenticated likes for published Explore shows. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { invalidateShowTemplatesCache } from '@/lib/admin.server';
import { createClient } from '@/utils/supabase/server';

type ToggleLikeResult =
  | { ok: true; liked: boolean; likeCount: number }
  | { ok: false; error: string; requiresAuth?: boolean };

const ToggleLikeSchema = z.object({
  presetId: z.string().uuid(),
  slug: z.string().trim().min(1).max(120),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function toggleShowPresetLikeAction(
  input: z.infer<typeof ToggleLikeSchema>,
): Promise<ToggleLikeResult> {
  const parsed = ToggleLikeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid show.' };

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    console.error('[toggleShowPresetLikeAction] auth check failed:', userError);
    return { ok: false, error: 'Your account could not be verified. Please try again.' };
  }
  if (!user) {
    return { ok: false, error: 'Sign in to save shows.', requiresAuth: true };
  }

  const { data, error } = await supabase.rpc('toggle_show_preset_like', {
    p_show_preset_id: parsed.data.presetId,
  });
  if (error) {
    console.error('[toggleShowPresetLikeAction] RPC failed:', error);
    return { ok: false, error: 'This show could not be saved. Please try again.' };
  }
  if (!isRecord(data) || data.ok !== true) {
    return {
      ok: false,
      error: isRecord(data) && typeof data.error === 'string' ? data.error : 'Invalid response.',
    };
  }

  const liked = data.liked === true;
  const likeCount = Number(data.likeCount);
  if (!Number.isInteger(likeCount) || likeCount < 0) {
    return { ok: false, error: 'This show could not be saved. Please try again.' };
  }

  await invalidateShowTemplatesCache();
  revalidatePath('/home');
  revalidatePath('/library');
  revalidatePath(`/library/${parsed.data.slug}`);
  return { ok: true, liked, likeCount };
}
