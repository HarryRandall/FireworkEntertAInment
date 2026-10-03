/** Bounded caller-RLS reads load a Studio document without creating drafts on navigation. */
import 'server-only';
import { designSchema } from '@showcrafter/fireworks';
import { getServerClient } from '@/lib/supabase/server-client';

/** Loads the active draft or published design, validating unknown JSON before rendering. */
export async function loadStudio(effectId: string) {
  const client = await getServerClient();
  const effect = await client
    .from('effects')
    .select('id,name,status,draft_version_id,current_version_id')
    .eq('id', effectId)
    .maybeSingle();
  if (effect.error) throw effect.error;
  if (!effect.data) return null;
  const versionId = effect.data.draft_version_id ?? effect.data.current_version_id;
  if (versionId === null) return { kind: 'empty' as const, effect: effect.data };
  const version = await client
    .from('effect_versions')
    .select('id,status,design')
    .eq('id', versionId)
    .eq('effect_id', effectId)
    .single();
  if (version.error) throw version.error;
  const published = await loadPublished(client, effectId, effect.data.current_version_id);
  return {
    published,
    kind: 'document' as const,
    effect: effect.data,
    versionId: version.data.status === 'draft' ? version.data.id : null,
    sourceVersionId: version.data.id,
    document: designSchema.parse(version.data.design),
  };
}

async function loadPublished(
  client: Awaited<ReturnType<typeof getServerClient>>,
  effectId: string,
  versionId: string | null,
) {
  if (versionId === null) return null;
  const result = await client
    .from('effect_versions')
    .select('id,number,design')
    .eq('id', versionId)
    .eq('effect_id', effectId)
    .eq('status', 'published')
    .single();
  if (result.error) throw result.error;
  return { number: result.data.number, document: designSchema.parse(result.data.design) };
}
