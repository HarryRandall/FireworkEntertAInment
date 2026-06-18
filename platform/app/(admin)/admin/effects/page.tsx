/** Admin effects page listing colourless base firework effects and style defaults. */

import { listAdminEffects, listAdminStyleDefaults } from '@/lib/admin.server';
import { EffectsBrowser } from './EffectsBrowser';

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminEffectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialTab = params.tab === 'defaults' ? 'defaults' : 'effects';

  const [effects, styleDefaults] = await Promise.all([
    listAdminEffects(),
    listAdminStyleDefaults(),
  ]);

  return <EffectsBrowser effects={effects} styleDefaults={styleDefaults} initialTab={initialTab} />;
}
