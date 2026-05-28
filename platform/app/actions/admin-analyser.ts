/** Server actions for short-lived analyser warm-up controls. */
'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/admin.server';
import {
  disableAnalyserWarmth,
  enableAnalyserWarmth,
  refreshAnalyserWarmth,
  type AnalyserWarmthState,
} from '@/lib/analyser-warmth.server';

const WarmthSchema = z.object({
  enabled: z.boolean(),
});

export async function setAnalyserWarmthAction(
  input: z.input<typeof WarmthSchema>,
): Promise<{ ok: true; state: AnalyserWarmthState } | { ok: false; error: string }> {
  const parsed = WarmthSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Warm-up setting is invalid.' };

  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return { ok: false, error: 'You do not have permission to manage the analyser.' };

  const state = parsed.data.enabled
    ? await enableAnalyserWarmth(admin.id)
    : await disableAnalyserWarmth();

  if (parsed.data.enabled) {
    after(async () => {
      const result = await refreshAnalyserWarmth({ force: true });
      if (!result.ok) console.error('[admin-analyser] warm-up failed:', result.error);
    });
  }

  revalidatePath('/admin');
  return { ok: true, state };
}
