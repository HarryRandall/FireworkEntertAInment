/** Lazily loaded replay canvas shared by the preset editor and its product picker. */
'use client';

import dynamic from 'next/dynamic';
import { ReplayCanvasSkeleton } from '@/ui/replay/ReplayCanvasSkeleton';

export const LazyFireworkReplayCanvas = dynamic(
  () => import('@/ui/replay/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <ReplayCanvasSkeleton /> },
);
