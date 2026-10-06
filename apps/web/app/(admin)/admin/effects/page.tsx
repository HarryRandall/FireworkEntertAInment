/** Admin effects page listing colourless base firework effects and style defaults. */

import { EffectsBrowser } from '@/app/(admin)/admin/effects/_components/EffectsBrowser';
import { parseAdminEffectsView } from '@/lib/admin-effects-navigation';
import { listAdminEffects } from '@/lib/admin/effects.server';

// Effect creation writes full model_json payloads through RLS checks, so it needs the
// same longer budget as catalogue reads/uploads instead of the platform default (see
// lib/supabase/fetch.ts) — otherwise a slow write surfaces as a timeout error.
export const maxDuration = 60;

type PageProps = {
  searchParams: Promise<{ view?: string; tab?: string }>;
};

export default async function AdminEffectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialView = parseAdminEffectsView(params.view, params.tab);

  const effects = await listAdminEffects();

  return <EffectsBrowser key={initialView} effects={effects} initialView={initialView} />;
}
