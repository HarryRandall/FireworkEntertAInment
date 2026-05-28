/** Server actions for short-lived analyser warm-up controls. */
'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/admin.server';
import {
  disableAnalyserWarmth,
  enableAnalyserWarmth,
  pingAnalyserWarmth,
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

export async function refreshAnalyserWarmthAction(): Promise<
  | { ok: true; state: AnalyserWarmthState }
  | { ok: false; error: string; state?: AnalyserWarmthState }
> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) {
    return { ok: false, error: 'You do not have permission to manage the analyser.' };
  }

  const result = await refreshAnalyserWarmth();
  revalidatePath('/admin');

  if (!result.ok) return { ok: false, error: result.error, state: result.state };
  return { ok: true, state: result.state };
}

export async function pingAnalyserWarmthAction(): Promise<
  { ok: true; warmedAt: string } | { ok: false; error: string; warmedAt?: string }
> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return { ok: false, error: 'You do not have permission to manage the analyser.' };

  return pingAnalyserWarmth();
}
