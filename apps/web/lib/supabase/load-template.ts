/** Published database template loading through the caller's ordinary RLS client. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { upgradeDesign } from '@showcrafter/fireworks/schema';
import type { Database } from '../database.types';

/** Reads a published effect's current design, validating stored input before rendering it. */
export async function loadTemplate(client: SupabaseClient<Database>, slug: string) {
  const effect = await client
    .from('effects')
    .select('name,family,current_version_id')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();
  if (effect.error) throw new Error(effect.error.message);
  if (effect.data.current_version_id === null)
    throw new Error('Published effect has no current version.');
  const version = await client
    .from('effect_versions')
    .select('design,design_schema')
    .eq('id', effect.data.current_version_id)
    .eq('status', 'published')
    .single();
  if (version.error) throw new Error(version.error.message);
  return {
    key: slug,
    name: effect.data.name,
    group: effect.data.family,
    design: upgradeDesign(version.data.design, version.data.design_schema),
  };
}
