/** On-demand history reads include the latest serially acknowledged Studio draft. */
'use server';
import { z } from 'zod';
import { requireArea } from '@/lib/auth/server';
import { loadStudioHistory } from './history-load';
/** Loads refreshed caller-RLS history after validating the firework address and staff access. */
export async function readStudioHistory(input: unknown) {
  const effectId = z.string().uuid().parse(input);
  await requireArea('admin');
  return loadStudioHistory(effectId);
}
