/** Server actions for short-lived analyser warm-up controls. */
'use server';

import { revalidatePath } from 'next/cache';
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
): Promise<
  | { ok: true; state: AnalyserWarmthState }
  | { ok: false; error: string; state?: AnalyserWarmthState }
> {
  const parsed = WarmthSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Warm-up setting is invalid.' };

  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return { ok: false, error: 'You do not have permission to manage the analyser.' };

  if (!parsed.data.enabled) {
    const state = await disableAnalyserWarmth();
    revalidatePath('/admin');
    return { ok: true, state };
  }

  await enableAnalyserWarmth(admin.id);
  const result = await refreshAnalyserWarmth({ force: true });
  if (!result.ok || !result.active) {
    const state = await disableAnalyserWarmth();
    revalidatePath('/admin');
    return {
      ok: false,
      error: result.ok
        ? 'The analyser warm-up ended before the service confirmed it was ready.'
        : result.error,
      state,
    };
  }

  revalidatePath('/admin');
  return { ok: true, state: result.state };
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
