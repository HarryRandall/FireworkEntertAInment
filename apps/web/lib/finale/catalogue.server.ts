/** Admin-only eligible firework reads for exact Finale cake name resolution. */
import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/access/current-profile.server';
import { upgradeDesign } from '@showcrafter/renderer';
import type { CakeEffect } from './document';

const CATALOGUE_PAGE_SIZE = 500; // PostgREST read batch, rows; below the default server limit.

/** Reads every firework, keeping invalid designs ineligible rather than substituting an effect. */
export async function readFinaleCakeEffects(): Promise<
  { ok: true; effects: CakeEffect[] } | { ok: false; error: string }
> {
  if (!(await requirePermission('admin.manage_catalogue')))
    return { ok: false, error: 'Not permitted.' };
  const supabase = createClient(await cookies());
  const effects: CakeEffect[] = [];
  for (let offset = 0; ; offset += CATALOGUE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('fireworks')
      .select('id, name, design, design_schema')
      .order('id')
      .range(offset, offset + CATALOGUE_PAGE_SIZE - 1);
    if (error) return { ok: false, error: 'The firework catalogue could not be read.' };
    for (const row of data ?? []) {
      let document: CakeEffect['document'] = { kind: 'unknown', breaks: [] };
      try {
        const design = upgradeDesign(row.design, row.design_schema);
        document = { kind: design.kind, breaks: design.breaks.map(() => null) };
      } catch {
        /* Missing or invalid saved designs remain ineligible. */
      }
      effects.push({ id: row.id, name: row.name, document });
    }
    if ((data?.length ?? 0) < CATALOGUE_PAGE_SIZE) return { ok: true, effects };
  }
}
