/** Admin effects page listing colourless base firework effects and style defaults. */

import { listAdminEffects, listAdminStyleDefaults } from '@/lib/admin.server';
import { parseAdminEffectsView } from '@/lib/admin-effects-navigation';
import { EffectsBrowser } from './EffectsBrowser';

// Effect creation writes full model_json payloads through RLS checks, so it needs the
// same longer budget as catalogue reads/uploads instead of the platform default (see
// utils/supabase/fetch.ts) — otherwise a slow write surfaces as a timeout error.
export const maxDuration = 60;

type PageProps = {
  searchParams: Promise<{ view?: string; tab?: string }>;
};

export default async function AdminEffectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialView = parseAdminEffectsView(params.view, params.tab);

  const [effects, styleDefaults] = await Promise.all([
    listAdminEffects(),
    listAdminStyleDefaults(),
  ]);

  return (
    <EffectsBrowser
      key={initialView}
      effects={effects}
      styleDefaults={styleDefaults}
      initialView={initialView}
    />
  );
}
