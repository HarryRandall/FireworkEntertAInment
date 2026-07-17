/** Admin effects page listing colourless base firework effects and style defaults. */

import { listAdminEffects, listAdminStyleDefaults } from '@/lib/admin.server';
import { parseAdminEffectsView } from '@/lib/admin-effects-navigation';
import { EffectsBrowser } from './EffectsBrowser';

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
